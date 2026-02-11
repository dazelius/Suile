/**
 * 음성 파일 → 텍스트 전사 (Gemini)
 *
 * 업로드된 음성 파일을 Gemini에 보내 한국어 텍스트로 전사합니다.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const TRANSCRIBE_PROMPT = `이 오디오 파일의 내용을 정확하게 한국어로 전사(transcribe)해주세요.

규칙:
- 오직 전사된 텍스트만 출력하세요
- 발화자를 구분할 수 있다면 "화자1:", "화자2:" 등으로 구분해주세요
- 잡음이나 불분명한 부분은 (...) 으로 표시해주세요
- 전사 이외의 설명이나 코멘트는 절대 추가하지 마세요`;

exports.transcribeAudio = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
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

    const { audio, mimeType } = req.body;

    if (!audio || !mimeType) {
      return res
        .status(400)
        .json({ error: "audio(base64)와 mimeType이 필요합니다." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: audio, mimeType } },
              { text: TRANSCRIBE_PROMPT },
            ],
          },
        ],
      });

      const transcript = result.text || "";

      if (!transcript.trim()) {
        return res.status(400).json({
          error: "음성을 인식할 수 없습니다.",
          tip: "오디오 파일에 음성이 포함되어 있는지 확인해주세요.",
        });
      }

      return res.json({ transcript: transcript.trim() });
    } catch (err) {
      console.error("[transcribeAudio] Error:", err.message || err);
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
        error: "음성 전사에 실패했습니다.",
        tip: "파일 형식을 확인하고 다시 시도해주세요. (mp3, wav, m4a, webm 지원)",
      });
    }
  }
);
