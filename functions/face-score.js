/**
 * 얼굴 평가 Cloud Function
 *
 * Gemini 2.5 Flash Vision으로 얼굴 분석.
 * 이미지는 저장하지 않으며, 분석 후 즉시 폐기.
 *
 * - faceScore : POST /api/faceScore (body: { image: "base64..." })
 */

const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");
const sharp = require("sharp");
const path = require("path");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SITE_URL = "https://suile-21173.web.app";
const OG_W = 1200;
const OG_H = 630;

// ── 프롬프트 ──
const FACE_ANALYSIS_PROMPT = `당신은 성형외과 전문의이자 안면 비율 분석 연구원입니다. 사용자의 정면 얼굴 사진을 황금비율(1:1.618), 삼정오안(三庭五眼) 이론, 좌우 대칭 지수 등 과학적 기준으로 정밀 분석하세요.

## 채점 기준 (정규분포 기반 — 엄격하게!)
- 일반인 평균: 55~65점 (이 구간이 가장 많아야 함)
- 70점 이상: 상위 20% (외모가 확실히 준수한 사람)
- 80점 이상: 상위 5% (연예인급, 아주 드물게)
- 90점 이상: 상위 1% (거의 주지 않음)
- 50점 이하: 하위 20%
- 절대로 모든 항목에 높은 점수를 주지 마세요. 차별화된 점수가 중요합니다.
- 각 부위별 점수도 40~95 범위에서 차등 있게 부여하세요.

## 분석 항목
1. **종합 점수** (0-100): 황금비율 근접도, 대칭성, 부위 조화도를 종합
2. **좌우 대칭 지수** (0-100): 눈 높이차, 코 중심선 편차, 입꼬리 수평도 등을 측정
3. **부위별 분석** (각 0-100):
   - 눈: 미간 대 눈 너비 비율, 눈꼬리 각도, 쌍커풀 대칭, 눈 크기 비율
   - 코: 코 길이 대 얼굴 길이 비율, 콧볼 너비, 브릿지 직선도, 코끝 각도
   - 입: 입술 너비 대 코 너비 비율, 상하 입술 비율(이상적: 1:1.6), 인중 길이
   - 피부: 색조 균일도, 질감, 잡티/모공 상태, 탄력감
   - 윤곽: 삼정(이마-코-턱) 비율, 광대 너비, 턱선 각도, 페이스라인 V라인 지수
   - 분위기: 표정 자연스러움, 눈빛 인상, 전체 조화도, 호감도
4. **추정 나이** (정수)
5. **닮은 유명인** 1명 + 닮은 정도(%)
6. **별명** (재미있되 구체적 근거 기반, 예: "황금비율 눈매", "대칭의 정석")
7. **종합 소견** (전문가 어투로 구체적 분석)
8. **스타일 팁** 1-2개

## 코멘트 작성 규칙
- 각 부위 코멘트는 과학적 용어 포함 필수 (비율, 각도, 대칭, 지수 등)
- 구체적 수치 근거를 언급하세요 (예: "미간:눈 비율 1:1.05로 이상적 범위", "코 길이가 안면 1/3에 근접")
- 장점과 아쉬운 점을 모두 솔직하게 언급하되, 비하하지 않을 것
- 혐오적이거나 차별적인 표현 절대 금지

## 주의사항
- 사진에 얼굴이 없거나 정면이 아닌 경우 isValidFace를 false로
- 예시의 점수를 그대로 따라하지 말고, 실제 분석 결과에 따라 점수를 부여하세요

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요:
{
  "isValidFace": true,
  "overallScore": 62,
  "symmetryScore": 68,
  "estimatedAge": 29,
  "nickname": "균형잡힌 인상파",
  "celebrity": { "name": "조인성", "similarity": 41 },
  "categories": {
    "eyes": { "score": 71, "comment": "미간:눈 너비 비율 1:1.05, 눈꼬리 각도 약간 처짐" },
    "nose": { "score": 58, "comment": "코 길이 안면 34%로 약간 길고, 콧볼 너비 보통" },
    "mouth": { "score": 65, "comment": "상하 입술비 1:1.4로 양호, 인중 길이 다소 김" },
    "skin": { "score": 72, "comment": "피부톤 균일하나 T존 모공 약간 보임" },
    "jawline": { "score": 55, "comment": "삼정 비율 1:0.9:1.1, 턱선 각도 완만한 편" },
    "vibe": { "score": 67, "comment": "온화한 인상, 표정 자연스러우나 눈빛 힘 약함" }
  },
  "oneLiner": "눈매의 밸런스가 좋고 피부 상태가 양호하나, 턱선과 코의 비율에서 소폭 아쉬움이 있는 균형형 얼굴.",
  "tips": ["이마를 살짝 드러내는 헤어로 삼정 비율을 보완하세요", "턱선 하이라이팅으로 V라인 효과를 줄 수 있습니다"]
}`;

// ── JSON 추출 ──
function extractJson(text) {
  // ```json ... ``` 블록 추출
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  // { ... } 직접 추출
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
  }
  return null;
}

// ── Cloud Function ──
exports.faceScore = onRequest(
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

    // API Key 확인
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" });
      return;
    }

    const { image } = req.body || {};
    if (!image || typeof image !== "string") {
      res.status(400).json({ error: "image (base64) 필드가 필요합니다" });
      return;
    }

    // base64에서 data:image/... 프리픽스 제거
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      console.log(`[FaceScore] Calling Gemini Vision...`);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: FACE_ANALYSIS_PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } }
          ]
        }]
      });

      const rawText = response.text || "";
      console.log(`[FaceScore] Response length: ${rawText.length}`);

      const parsed = extractJson(rawText);
      if (!parsed) {
        console.log(`[FaceScore] Failed to parse JSON from: ${rawText.substring(0, 300)}`);
        res.status(500).json({
          error: "얼굴을 정확히 인식하지 못했습니다.",
          code: "PARSE_FAIL",
          tip: "정면을 바라보고, 밝은 곳에서 다시 촬영해주세요."
        });
        return;
      }

      // isValidFace 체크
      if (parsed.isValidFace === false) {
        res.status(400).json({
          error: "얼굴이 감지되지 않았습니다.",
          code: "NO_FACE",
          tip: "정면을 바라보고, 얼굴 전체가 화면에 나오도록 다시 촬영해주세요."
        });
        return;
      }

      // 캐시 안 함 (개인정보)
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.json(parsed);

    } catch (err) {
      console.error("[FaceScore] Error:", err.message);
      const msg = String(err.message || "");
      // 에러 유형별 친절한 메시지
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        res.status(429).json({
          error: "요청이 많아 일시적으로 분석이 제한됩니다.",
          code: "RATE_LIMIT",
          tip: "잠시 후(약 1분) 다시 시도해주세요. 현재 많은 분들이 이용 중입니다."
        });
      } else if (msg.includes("SAFETY") || msg.includes("safety") || msg.includes("blocked")) {
        res.status(400).json({
          error: "사진을 분석할 수 없습니다.",
          code: "SAFETY",
          tip: "선명한 정면 얼굴 사진으로 다시 시도해주세요. 부적절한 이미지는 분석이 제한됩니다."
        });
      } else if (msg.includes("timeout") || msg.includes("DEADLINE") || msg.includes("TIMEOUT")) {
        res.status(500).json({
          error: "분석 시간이 초과되었습니다.",
          code: "TIMEOUT",
          tip: "서버가 바쁜 것 같습니다. 잠시 후 다시 시도해주세요."
        });
      } else {
        res.status(500).json({
          error: "얼굴 분석에 실패했습니다.",
          code: "UNKNOWN",
          tip: "일시적인 오류일 수 있습니다. 잠시 후 다시 촬영해주세요."
        });
      }
    }
  }
);

// ============================================
// faceScoreOg - 동적 OG 이미지 생성
// GET /faceScoreOg?score=72&age=28&celeb=차은우
// ============================================
function escXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

exports.faceScoreOg = onRequest(
  { region: "asia-northeast3", memory: "512MiB", maxInstances: 10 },
  async (req, res) => {
    const score = String(req.query.score || "??");
    const age = String(req.query.age || "??");
    const celeb = escXml(String(req.query.celeb || "분석 필요"));

    try {
      // 1) Gwansang.png 로드 → 리사이즈 + 블러
      const bgPath = path.join(__dirname, "gwansang.png");
      const blurred = await sharp(bgPath)
        .resize(OG_W, OG_H, { fit: "cover" })
        .blur(18)
        .toBuffer();

      // 2) 어두운 반투명 오버레이 (SVG)
      const darkOverlay = Buffer.from(
        `<svg width="${OG_W}" height="${OG_H}"><rect width="${OG_W}" height="${OG_H}" fill="rgba(0,0,0,0.55)"/></svg>`
      );

      // 3) 텍스트 오버레이 (SVG)
      const textSvg = Buffer.from(`<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <!-- 상단 배지 -->
  <rect x="${OG_W / 2 - 110}" y="50" width="220" height="36" rx="18" fill="rgba(139,92,246,0.85)"/>
  <text x="${OG_W / 2}" y="75" text-anchor="middle" font-size="16" font-weight="bold" fill="white" font-family="sans-serif">AI 얼굴 평가 · 관상 분석</text>

  <!-- 추정 나이 -->
  <text x="${OG_W / 2}" y="195" text-anchor="middle" font-size="32" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-weight="bold">추정 나이</text>
  <text x="${OG_W / 2}" y="260" text-anchor="middle" font-size="72" font-weight="900" fill="#e9d5ff" font-family="sans-serif">${escXml(age)}세</text>

  <!-- 종합 점수 -->
  <text x="${OG_W / 2}" y="350" text-anchor="middle" font-size="90" font-weight="900" fill="white" font-family="sans-serif">${escXml(score)}점</text>

  <!-- 닮은 연예인 -->
  <text x="${OG_W / 2}" y="430" text-anchor="middle" font-size="36" font-weight="bold" fill="#c4b5fd" font-family="sans-serif">닮은 연예인: ${celeb}</text>

  <!-- 하단 구분선 + 브랜드 -->
  <line x1="${OG_W / 2 - 60}" y1="530" x2="${OG_W / 2 + 60}" y2="530" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
  <text x="${OG_W / 2}" y="570" text-anchor="middle" font-size="18" font-weight="bold" fill="rgba(255,255,255,0.5)" font-family="sans-serif">SUILE</text>
</svg>`);

      // 4) 합성: 배경(블러) + 어두운 오버레이 + 텍스트
      const result = await sharp(blurred)
        .composite([
          { input: darkOverlay, top: 0, left: 0 },
          { input: textSvg, top: 0, left: 0 },
        ])
        .png()
        .toBuffer();

      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.set("Content-Type", "image/png");
      res.send(result);
    } catch (err) {
      console.error("[FaceScoreOg] Error:", err.message);
      res.status(500).send("Image generation failed");
    }
  }
);

// ============================================
// faceScoreView - 동적 OG HTML 서빙
// GET /fs?score=72&age=28&celeb=차은우
// ============================================
exports.faceScoreView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 10 },
  async (req, res) => {
    const score = String(req.query.score || "");
    const age = String(req.query.age || "");
    const celeb = String(req.query.celeb || "");

    if (!score) {
      res.redirect(302, `${SITE_URL}/tools/face-score`);
      return;
    }

    const title = `AI 얼굴 평가: ${score}점 · ${age}세`;
    const description = `추정 나이 ${age}세, 종합 ${score}점 · 닮은 연예인: ${celeb} — AI가 분석한 얼굴 평가 결과를 확인하세요!`;
    const ogImageUrl = `${SITE_URL}/faceScoreOg?score=${encodeURIComponent(score)}&age=${encodeURIComponent(age)}&celeb=${encodeURIComponent(celeb)}`;
    const redirectUrl = `${SITE_URL}/tools/face-score`;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:image" content="${ogImageUrl}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${description}"/>
<meta name="twitter:image" content="${ogImageUrl}"/>
<meta http-equiv="refresh" content="0;url=${redirectUrl}"/>
</head><body><p>Redirecting...</p><script>location.href="${redirectUrl}";</script></body></html>`;

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.send(html);
  }
);
