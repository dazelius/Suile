/**
 * 주식 AI 분석 Cloud Function
 *
 * Gemini 2.5 Flash + Google Search Grounding으로
 * 최신 뉴스와 재무 데이터를 종합한 AI 투자 분석 제공.
 *
 * - stockAiAnalysis : GET /api/stockAi?ticker=AAPL&data=JSON
 *   → Firestore 24시간 캐시
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenAI } = require("@google/genai");

// Firebase Admin (중복 방지)
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ── 오늘 날짜 (KST) ──
function todayKST() {
  const d = new Date();
  d.setHours(d.getHours() + 9);
  return d.toISOString().split("T")[0];
}

// ── 프롬프트 생성 ──
function buildPrompt(ticker, name, financials) {
  const lines = [];
  if (financials.price) lines.push(`현재가: $${financials.price}`);
  if (financials.marketCap) {
    const mc = financials.marketCap;
    lines.push(`시가총액: ${mc >= 1e12 ? `$${(mc/1e12).toFixed(1)}T` : mc >= 1e9 ? `$${(mc/1e9).toFixed(0)}B` : `$${(mc/1e6).toFixed(0)}M`}`);
  }
  if (financials.pe) lines.push(`PER: ${financials.pe.toFixed(1)}`);
  if (financials.forwardPE) lines.push(`Forward PE: ${financials.forwardPE.toFixed(1)}`);
  if (financials.pb) lines.push(`PBR: ${financials.pb.toFixed(1)}`);
  if (financials.returnOnEquity) lines.push(`ROE: ${(financials.returnOnEquity * 100).toFixed(1)}%`);
  if (financials.profitMargins) lines.push(`순이익률: ${(financials.profitMargins * 100).toFixed(1)}%`);
  if (financials.revenueGrowth) lines.push(`매출 성장률: ${(financials.revenueGrowth * 100).toFixed(1)}%`);
  if (financials.earningsGrowth) lines.push(`이익 성장률: ${(financials.earningsGrowth * 100).toFixed(1)}%`);
  if (financials.debtToEquity != null) lines.push(`부채비율: ${financials.debtToEquity.toFixed(0)}%`);
  if (financials.divYield) lines.push(`배당수익률: ${(financials.divYield * 100).toFixed(1)}%`);
  if (financials.w52change) lines.push(`52주 수익률: ${(financials.w52change * 100).toFixed(1)}%`);

  return `당신은 월스트리트 출신의 전문 주식 애널리스트입니다.
${ticker} (${name})에 대해 아래 재무 데이터와 최신 뉴스를 종합하여 실전 투자에 도움이 되는 분석을 해주세요.

[재무 데이터]
${lines.join("\n")}

아래 형식으로 정확히 작성하세요:

[최근 동향]
최신 뉴스를 바탕으로 이 기업의 최근 주요 이슈를 2-3문장으로 요약.

[투자 매력]
- 매력 포인트 1
- 매력 포인트 2
- 매력 포인트 3

[리스크]
- 리스크 1
- 리스크 2
- 리스크 3

[종합 의견]
한 문장으로 핵심 결론.

규칙:
- 한국어로 작성
- 각 섹션은 간결하게 (전체 500자 이내)
- 뉴스에 기반한 구체적 내용을 포함 (막연한 일반론 금지)
- 숫자와 데이터를 적극 활용`;
}

// ── AI 분석 결과 파싱 ──
function parseAiResponse(text) {
  const sections = {
    recentTrend: "",
    strengths: [],
    risks: [],
    conclusion: "",
  };

  // 섹션별 추출
  const trendMatch = text.match(/\[최근 동향\]\s*([\s\S]*?)(?=\[투자 매력\]|$)/);
  const strengthMatch = text.match(/\[투자 매력\]\s*([\s\S]*?)(?=\[리스크\]|$)/);
  const riskMatch = text.match(/\[리스크\]\s*([\s\S]*?)(?=\[종합 의견\]|$)/);
  const conclusionMatch = text.match(/\[종합 의견\]\s*([\s\S]*?)$/);

  if (trendMatch) sections.recentTrend = trendMatch[1].trim();
  if (strengthMatch) {
    sections.strengths = strengthMatch[1]
      .split("\n")
      .map(l => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  }
  if (riskMatch) {
    sections.risks = riskMatch[1]
      .split("\n")
      .map(l => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  }
  if (conclusionMatch) sections.conclusion = conclusionMatch[1].trim();

  // 파싱 실패 시 원문 반환
  if (!sections.recentTrend && !sections.conclusion) {
    sections.recentTrend = text;
  }

  return sections;
}

// ============================================
// stockAiAnalysis
// GET /api/stockAi?ticker=AAPL&data={...}
// ============================================
exports.stockAiAnalysis = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 5, timeoutSeconds: 60 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const ticker = String(req.query.ticker || "").trim().toUpperCase();
    if (!ticker) {
      res.status(400).json({ error: "ticker 파라미터가 필요합니다" });
      return;
    }

    // 재무 데이터 (프론트에서 전달)
    let financials = {};
    try {
      if (req.query.data) financials = JSON.parse(req.query.data);
    } catch { /* 무시 */ }
    const name = financials.name || ticker;

    try {
      const today = todayKST();

      // ── Firestore 캐시 확인 ──
      try {
        const doc = await db.collection("stockAiCache").doc(ticker).get();
        if (doc.exists) {
          const cached = doc.data();
          if (cached.date === today && cached.analysis) {
            console.log(`[StockAI] Cache hit for ${ticker}`);
            res.set("Cache-Control", "public, max-age=3600, s-maxage=43200");
            res.json(JSON.parse(cached.analysis));
            return;
          }
        }
      } catch (e) {
        console.log("Firestore cache read failed:", e.message);
      }

      // ── Gemini 호출 ──
      if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" });
        return;
      }

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const prompt = buildPrompt(ticker, name, financials);

      console.log(`[StockAI] Calling Gemini for ${ticker}...`);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = response.text || "";
      const parsed = parseAiResponse(rawText);

      // 뉴스 출처 추출
      const sources = [];
      try {
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks && Array.isArray(chunks)) {
          for (const chunk of chunks) {
            if (chunk.web) {
              sources.push({
                title: chunk.web.title || "",
                url: chunk.web.uri || "",
              });
            }
          }
        }
      } catch { /* 출처 없어도 OK */ }

      const result = {
        ticker,
        name,
        date: today,
        ...parsed,
        sources: sources.slice(0, 5), // 최대 5개 출처
      };

      // ── Firestore에 캐시 저장 ──
      try {
        await db.collection("stockAiCache").doc(ticker).set({
          date: today,
          analysis: JSON.stringify(result),
        });
        console.log(`[StockAI] Cached analysis for ${ticker}`);
      } catch (e) {
        console.error("Firestore write failed:", e.message);
      }

      res.set("Cache-Control", "public, max-age=3600, s-maxage=43200");
      res.json(result);
    } catch (err) {
      console.error("stockAiAnalysis failed:", err);
      res.status(500).json({ error: err.message || "AI 분석 중 오류가 발생했습니다" });
    }
  }
);
