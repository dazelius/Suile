/**
 * 회의록 AI 정리 Cloud Function
 *
 * - meetingAi : POST /api/meetingAi (body: { text, duration })
 */

const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MEETING_PROMPT = `당신은 전문 비서이자 회의록 정리 전문가입니다. 아래 회의 전사 텍스트를 분석하여 구조화된 회의록으로 정리하세요.

## 정리 항목
1. **title**: 회의 주제를 한 문장으로 요약한 제목
2. **summary**: 회의 핵심 내용을 3-5문장으로 요약
3. **actionItems**: 누가 무엇을 해야 하는지 추출 (배열)
   - who: 담당자 (언급이 없으면 "미정")
   - what: 해야 할 일
   - deadline: 기한 (언급이 없으면 빈 문자열)
4. **decisions**: 회의에서 확정된 결정사항 (배열)
5. **followUps**: 후속으로 필요한 조치/확인사항 (배열)
6. **keywords**: 핵심 키워드 3-5개 (배열)
7. **duration**: 회의 소요 시간 (입력값 그대로 사용)

## 규칙
- 전사 텍스트가 비공식적이거나 구어체여도 전문적으로 정리하세요
- 불필요한 감탄사, 반복, 군말은 제거하고 핵심만 추출하세요
- 액션 아이템은 최대한 구체적으로, 측정 가능한 형태로 작성하세요
- 언급된 사람 이름이 있으면 그대로 사용하세요
- 내용이 너무 짧거나 회의 내용이 아니어도 최선을 다해 정리하세요
- 한국어로 작성하세요

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요:
{
  "title": "회의 제목",
  "summary": "핵심 요약",
  "actionItems": [{ "who": "담당자", "what": "할 일", "deadline": "기한" }],
  "decisions": ["결정사항1"],
  "followUps": ["후속조치1"],
  "keywords": ["키워드1", "키워드2"],
  "duration": "소요시간"
}`;

// ── JSON 추출 ──
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
  }
  return null;
}

// ── Cloud Function ──
exports.meetingAi = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10, timeoutSeconds: 60 },
  async (req, res) => {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    if (req.method !== "POST") {
      res.status(405).json({ error: "POST만 지원합니다" });
      return;
    }

    if (!GEMINI_API_KEY) {
      res.status(500).json({ error: "API 키가 설정되지 않았습니다" });
      return;
    }

    const { text, duration } = req.body || {};
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      res.status(400).json({ error: "텍스트가 너무 짧습니다. 더 많은 내용을 녹음해주세요." });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const userMessage = `회의 소요 시간: ${duration || "미정"}\n\n회의 전사 텍스트:\n${text}`;

      console.log(`[MeetingAi] Text length: ${text.length}, duration: ${duration}`);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: MEETING_PROMPT },
            { text: userMessage }
          ]
        }]
      });

      const rawText = response.text || "";
      console.log(`[MeetingAi] Response length: ${rawText.length}`);

      const parsed = extractJson(rawText);
      if (!parsed) {
        console.log(`[MeetingAi] Parse failed: ${rawText.substring(0, 300)}`);
        res.status(500).json({ error: "AI 응답을 파싱하지 못했습니다. 다시 시도해주세요." });
        return;
      }

      // duration 보강
      if (!parsed.duration && duration) {
        parsed.duration = duration;
      }

      res.set("Cache-Control", "no-cache, no-store");
      res.json(parsed);

    } catch (err) {
      console.error("[MeetingAi] Error:", err.message);
      const msg = String(err.message || "");
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        res.status(429).json({ error: "요청이 많아 일시적으로 분석이 제한됩니다. 잠시 후(약 1분) 다시 시도해주세요." });
      } else {
        res.status(500).json({ error: "AI 분석 중 오류가 발생했습니다. 다시 시도해주세요." });
      }
    }
  }
);
