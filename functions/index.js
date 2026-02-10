const { onRequest } = require("firebase-functions/v2/https");
const QRCode = require("qrcode");
const sharp = require("sharp");

const CARD_WIDTH = 600;
const CARD_HEIGHT = 820;
const QR_SIZE = 260;
const SITE_URL = "https://suile-21173.web.app";

/**
 * Base64 URL-safe 디코딩 → JSON 파싱
 */
function decodeLetterData(encoded) {
  try {
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * XML 특수문자 이스케이프
 */
function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 카드 SVG 생성 (QR코드 제외한 텍스트/배경 레이어)
 */
function buildCardSvg(from, to) {
  const hasFrom = from && from !== "익명" && from.length > 0;
  const hasTo = to && to.length > 0;

  // 메시지 문구 결정
  let lines = [];
  if (hasFrom && hasTo) {
    lines = [
      `${escXml(from)}님이`,
      `${escXml(to)}님에게 보내는`,
      "비밀 메시지에요",
    ];
  } else if (hasFrom) {
    lines = [`${escXml(from)}님이 보내는`, "비밀 메시지에요"];
  } else if (hasTo) {
    lines = [`${escXml(to)}님에게 도착한`, "비밀 메시지에요"];
  } else {
    lines = ["비밀 메시지가", "도착했어요"];
  }

  // 텍스트 y 좌표 계산
  const msgStartY = 178;
  const lineHeight = 34;

  const msgTexts = lines
    .map(
      (line, i) =>
        `<text x="${CARD_WIDTH / 2}" y="${msgStartY + i * lineHeight}" text-anchor="middle" font-size="22" font-weight="bold" fill="#18181b" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">${line}</text>`
    )
    .join("\n    ");

  const dividerY2 = msgStartY + lines.length * lineHeight + 12;
  const qrY = dividerY2 + 24;
  const footerY1 = qrY + QR_SIZE + 40 + 40;
  const footerY2 = footerY1 + 28;

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- 배경 -->
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="0" fill="#f4f4f5"/>
  
  <!-- 카드 본체 -->
  <rect x="16" y="16" width="${CARD_WIDTH - 32}" height="${CARD_HEIGHT - 32}" rx="24" fill="white" stroke="#e4e4e7" stroke-width="1"/>
  
  <!-- SUILE 브랜딩 -->
  <text x="${CARD_WIDTH / 2}" y="72" text-anchor="middle" font-size="28" font-weight="bold" fill="#18181b" font-family="'Geist','Pretendard',sans-serif">SUILE</text>
  <text x="${CARD_WIDTH / 2}" y="100" text-anchor="middle" font-size="13" fill="#a1a1aa" font-family="'Geist','Pretendard',sans-serif">QR 비밀 메시지</text>
  
  <!-- 점선 구분 1 -->
  <line x1="56" y1="124" x2="${CARD_WIDTH - 56}" y2="124" stroke="#e4e4e7" stroke-width="1.5" stroke-dasharray="6,4"/>
  
  <!-- 메시지 문구 -->
  ${msgTexts}
  
  <!-- 점선 구분 2 -->
  <line x1="56" y1="${dividerY2}" x2="${CARD_WIDTH - 56}" y2="${dividerY2}" stroke="#e4e4e7" stroke-width="1.5" stroke-dasharray="6,4"/>
  
  <!-- QR 배경 -->
  <rect x="${(CARD_WIDTH - QR_SIZE - 32) / 2}" y="${qrY - 16}" width="${QR_SIZE + 32}" height="${QR_SIZE + 32}" rx="16" fill="#fafafa" stroke="#e4e4e7" stroke-width="1"/>
  
  <!-- 하단 안내 -->
  <text x="${CARD_WIDTH / 2}" y="${footerY1}" text-anchor="middle" font-size="14" fill="#a1a1aa" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">QR코드를 스캔하면 비밀 메시지가 열려요</text>
  <text x="${CARD_WIDTH / 2}" y="${footerY2}" text-anchor="middle" font-size="12" fill="#d4d4d8" font-family="'Geist','Pretendard',sans-serif">suile-21173.web.app</text>
</svg>`;
}

/**
 * OG 이미지 생성 Cloud Function
 * GET /ogImage?d=encodedData
 */
exports.ogImage = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    const encoded = req.query.d;

    if (!encoded) {
      res.status(400).send("Missing data parameter");
      return;
    }

    const data = decodeLetterData(encoded);
    const from = data?.from || "";
    const to = data?.to || "";

    try {
      // 1. QR코드 PNG 버퍼 생성
      const messageUrl = `${SITE_URL}/m?d=${encoded}`;
      const qrBuffer = await QRCode.toBuffer(messageUrl, {
        width: QR_SIZE,
        margin: 1,
        color: { dark: "#18181b", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });

      // 2. 카드 SVG 생성
      const cardSvg = buildCardSvg(from, to);
      const cardBuffer = Buffer.from(cardSvg);

      // 3. QR 위치 계산
      const hasFrom = from && from !== "익명" && from.length > 0;
      const hasTo = to && to.length > 0;
      let lineCount = 2;
      if (hasFrom && hasTo) lineCount = 3;
      const msgStartY = 178;
      const dividerY2 = msgStartY + lineCount * 34 + 12;
      const qrY = dividerY2 + 24;
      const qrX = (CARD_WIDTH - QR_SIZE) / 2;

      // 4. 합성: 카드 배경 + QR코드 오버레이
      const result = await sharp(cardBuffer)
        .resize(CARD_WIDTH, CARD_HEIGHT)
        .composite([
          {
            input: await sharp(qrBuffer)
              .resize(QR_SIZE, QR_SIZE)
              .toBuffer(),
            left: qrX,
            top: qrY,
          },
        ])
        .png()
        .toBuffer();

      // 5. 캐시 + 응답
      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.set("Content-Type", "image/png");
      res.send(result);
    } catch (err) {
      console.error("OG image generation failed:", err);
      res.status(500).send("Image generation failed");
    }
  }
);

/**
 * /m 페이지 서빙 Cloud Function
 * 동적 OG meta 태그를 삽입한 HTML을 반환
 */
exports.messageView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 20 },
  async (req, res) => {
    const encoded = req.query.d;

    if (!encoded) {
      // 데이터 없으면 정적 /m 페이지로 리다이렉트
      res.redirect("/m.html");
      return;
    }

    const data = decodeLetterData(encoded);
    const hasTo = data?.to && data.to.length > 0;
    const hasFrom = data?.from && data.from !== "익명";

    const title = hasTo
      ? `${escXml(data.to)}님에게 비밀 메시지가 도착했어요`
      : "비밀 메시지가 도착했어요";

    const description = hasFrom
      ? `${escXml(data.from)}님이 보낸 비밀 메시지를 확인하세요!`
      : "누군가 보낸 비밀 메시지를 확인하세요!";

    // OG 이미지 URL = Cloud Function의 ogImage 엔드포인트
    const ogImageUrl = `https://asia-northeast3-suile-21173.cloudfunctions.net/ogImage?d=${encodeURIComponent(encoded)}`;
    const pageUrl = `${SITE_URL}/v?d=${encodeURIComponent(encoded)}`;

    // 정적 /m 페이지의 HTML을 기반으로 OG meta만 주입
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
  <title>${title} | SUILE</title>
  <meta name="description" content="${description}"/>
  
  <!-- Open Graph -->
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${ogImageUrl}"/>
  <meta property="og:image:width" content="600"/>
  <meta property="og:image:height" content="820"/>
  <meta property="og:url" content="${pageUrl}"/>
  <meta property="og:site_name" content="SUILE"/>
  <meta property="og:locale" content="ko_KR"/>
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="${ogImageUrl}"/>
  
  <!-- AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1349078633848665" crossorigin="anonymous"></script>
  
  <!-- 실제 앱 페이지로 리다이렉트 (크롤러는 JS 실행 안함 → OG meta만 읽음) -->
  <meta http-equiv="refresh" content="0;url=/m?d=${encodeURIComponent(encoded)}"/>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#71717a;">
    <p>메시지를 불러오는 중...</p>
  </div>
  <script>window.location.replace('/m?d=${encodeURIComponent(encoded)}');</script>
</body>
</html>`;

    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }
);
