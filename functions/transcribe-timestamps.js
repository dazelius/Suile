/**
 * 영상 → 타임스탬프 자막 생성 (Gemini)
 *
 * 숏폼 편집기에서 사용:
 * - 오디오(base64) + 프레임 이미지(base64[])를 보내면
 * - 음성이 있으면 전사, 없으면 영상 내용 해설 자막 생성
 * - [{start, end, text}] 형태의 JSON을 반환
 */
const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CAPTION_PROMPT = `숏폼 자막과 핵심 주제를 JSON으로 생성해줘. 음성이 있으면 전사, 없으면 화면 해설.
출력: {"title":"영상 핵심 주제 6자 이내","captions":[{"start":0.0,"end":3.0,"text":"자막"}]}
title: 영상의 핵심 주제/제목을 한눈에 알수있게 6자 이내 한국어.
captions: 10~15개 이내. 한 구간 2~5초, 12자 이내. 빈 구간 생략.
코드블록 없이 JSON만.`;

exports.transcribeWithTimestamps = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { audio, mimeType, frames } = req.body;
    // frames: [{time: number, data: string(base64)}]

    if (!audio && (!frames || frames.length === 0)) {
      return res
        .status(400)
        .json({ error: "audio 또는 frames가 필요합니다." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // Build multimodal parts
      const parts = [];

      // Add audio if present
      if (audio && mimeType) {
        parts.push({ inlineData: { data: audio, mimeType } });
      }

      // Add frame images with timestamps
      if (frames && Array.isArray(frames)) {
        for (const frame of frames) {
          parts.push({
            text: `[프레임 ${frame.time.toFixed(1)}초]`,
          });
          parts.push({
            inlineData: {
              data: frame.data,
              mimeType: "image/jpeg",
            },
          });
        }
      }

      // Add the prompt last
      parts.push({ text: CAPTION_PROMPT });

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      });

      const raw = (result.text || "").trim();

      if (!raw) {
        return res.json({ captions: [] });
      }

      // Gemini가 코드블록으로 감쌀 수 있으므로 정리
      let jsonStr = raw;
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        console.warn("[transcribeTimestamps] JSON parse failed, raw:", raw.substring(0, 200));
        parsed = [{ start: 0, end: 60, text: raw.substring(0, 50) }];
      }

      // Support both formats: {title, captions} or plain array
      let title = "";
      let captions;
      if (Array.isArray(parsed)) {
        captions = parsed;
      } else if (parsed && typeof parsed === "object") {
        title = typeof parsed.title === "string" ? parsed.title.trim() : "";
        captions = Array.isArray(parsed.captions) ? parsed.captions : [];
      } else {
        captions = [{ start: 0, end: 60, text: String(parsed).substring(0, 50) }];
      }

      // 각 항목 정규화
      captions = captions
        .filter((c) => c && typeof c.text === "string" && c.text.trim())
        .map((c) => ({
          start: typeof c.start === "number" ? c.start : 0,
          end: typeof c.end === "number" ? c.end : 0,
          text: c.text.trim(),
        }));

      return res.json({ title, captions });
    } catch (err) {
      console.error("[transcribeTimestamps] Error:", err.message || err);
      const msg = String(err.message || "");

      if (
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("quota")
      ) {
        return res.status(429).json({
          error: "요청이 많아 일시적으로 제한됩니다.",
          tip: "잠시 후(약 1분) 다시 시도해주세요.",
        });
      }

      return res.status(500).json({
        error: "자막 생성에 실패했습니다.",
        tip: "파일 형식을 확인하고 다시 시도해주세요.",
      });
    }
  }
);
