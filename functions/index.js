const { onRequest } = require("firebase-functions/v2/https");
const sharp = require("sharp");

const CARD_WIDTH = 600;
const CARD_HEIGHT = 400;
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
 * 메시지를 블라인드 처리
 * "안녕하세요 반갑습니다" → "■■■■■ ■■■■■"
 * 글자 수와 공백/줄바꿈 구조는 유지, 내용은 ■로 치환
 */
function blindMessage(message) {
  return message.replace(/[^\s]/g, "■");
}

/**
 * 블라인드 메시지를 여러 줄로 분할 (SVG용, 한 줄 최대 약 20자)
 */
function splitBlindLines(blind, maxChars = 22) {
  // 줄바꿈 먼저 처리
  const rawLines = blind.split(/\n/);
  const result = [];
  for (const raw of rawLines) {
    if (raw.length <= maxChars) {
      result.push(raw);
    } else {
      // 긴 줄은 공백 기준으로 분할
      const words = raw.split(" ");
      let current = "";
      for (const word of words) {
        if (current.length + word.length + 1 > maxChars && current.length > 0) {
          result.push(current);
          current = word;
        } else {
          current = current ? current + " " + word : word;
        }
      }
      if (current) result.push(current);
    }
  }
  return result.slice(0, 6); // 최대 6줄
}

/**
 * OG 카드 SVG 생성 (블라인드 메시지 스타일)
 */
function buildOgSvg(from, to, message) {
  const hasFrom = from && from !== "익명" && from.length > 0;
  const hasTo = to && to.length > 0;

  // 상단 문구
  let headerText = "비밀 메시지가 도착했어요";
  if (hasFrom && hasTo) {
    headerText = `${escXml(from)}님이 ${escXml(to)}님에게`;
  } else if (hasFrom) {
    headerText = `${escXml(from)}님이 보낸 메시지`;
  } else if (hasTo) {
    headerText = `${escXml(to)}님에게 온 메시지`;
  }

  // 블라인드 메시지 줄 생성
  const blind = blindMessage(message || "비밀 메시지");
  const blindLines = splitBlindLines(blind);
  const blindStartY = 195;
  const blindLineHeight = 36;

  const blindTexts = blindLines
    .map(
      (line, i) =>
        `<text x="${CARD_WIDTH / 2}" y="${blindStartY + i * blindLineHeight}" text-anchor="middle" font-size="26" fill="#3f3f46" font-family="'Pretendard','Apple SD Gothic Neo',monospace" letter-spacing="2">${escXml(line)}</text>`
    )
    .join("\n    ");

  const footerY = Math.max(blindStartY + blindLines.length * blindLineHeight + 30, 340);
  const actualHeight = footerY + 40;

  return {
    svg: `<svg width="${CARD_WIDTH}" height="${actualHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- 배경 -->
  <rect width="${CARD_WIDTH}" height="${actualHeight}" rx="0" fill="#18181b"/>
  
  <!-- 카드 -->
  <rect x="20" y="20" width="${CARD_WIDTH - 40}" height="${actualHeight - 40}" rx="20" fill="#27272a"/>
  
  <!-- 잠금 아이콘 (원형 + 자물쇠 모양) -->
  <circle cx="${CARD_WIDTH / 2}" cy="62" r="22" fill="#3f3f46"/>
  <rect x="${CARD_WIDTH / 2 - 8}" y="56" width="16" height="12" rx="2" fill="#a1a1aa"/>
  <path d="M${CARD_WIDTH / 2 - 5} 56 V52 a5 5 0 0 1 10 0 V56" fill="none" stroke="#a1a1aa" stroke-width="2.5" stroke-linecap="round"/>

  <!-- 헤더 문구 -->
  <text x="${CARD_WIDTH / 2}" y="115" text-anchor="middle" font-size="18" font-weight="bold" fill="#fafafa" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">${headerText}</text>
  
  <!-- 구분선 -->
  <line x1="60" y1="140" x2="${CARD_WIDTH - 60}" y2="140" stroke="#3f3f46" stroke-width="1"/>
  
  <!-- "제가 하고 싶은 말은..." -->
  <text x="${CARD_WIDTH / 2}" y="168" text-anchor="middle" font-size="13" fill="#71717a" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">제가 하고 싶은 말은...</text>
  
  <!-- 블라인드 메시지 -->
  ${blindTexts}
  
  <!-- 하단 안내 -->
  <text x="${CARD_WIDTH / 2}" y="${footerY}" text-anchor="middle" font-size="12" fill="#52525b" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">링크를 열어 비밀 메시지를 확인하세요</text>
  <text x="${CARD_WIDTH / 2}" y="${footerY + 20}" text-anchor="middle" font-size="11" fill="#3f3f46" font-family="'Geist','Pretendard',sans-serif">SUILE</text>
</svg>`,
    height: actualHeight,
  };
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

    try {
      const { svg, height } = buildOgSvg(
        data?.from || "",
        data?.to || "",
        data?.message || ""
      );

      const result = await sharp(Buffer.from(svg))
        .resize(CARD_WIDTH, height)
        .png()
        .toBuffer();

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
 * /v 페이지 서빙 Cloud Function
 * 동적 OG meta 태그를 삽입한 HTML을 반환 후 /m으로 리다이렉트
 */
exports.messageView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 20 },
  async (req, res) => {
    const encoded = req.query.d;

    if (!encoded) {
      res.redirect("/m.html");
      return;
    }

    const data = decodeLetterData(encoded);
    const hasTo = data?.to && data.to.length > 0;
    const hasFrom = data?.from && data.from !== "익명";

    // 타이틀
    const title = hasTo
      ? `${escXml(data.to)}님에게 비밀 메시지가 도착했어요`
      : "비밀 메시지가 도착했어요";

    // 디스크립션: "제가 하고 싶은 말은..."
    const description = "제가 하고 싶은 말은...";

    // OG 이미지 URL
    const ogImageUrl = `https://asia-northeast3-suile-21173.cloudfunctions.net/ogImage?d=${encodeURIComponent(encoded)}`;
    const pageUrl = `${SITE_URL}/v?d=${encodeURIComponent(encoded)}`;

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
  <meta property="og:image:width" content="${CARD_WIDTH}"/>
  <meta property="og:image:height" content="400"/>
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
  
  <!-- 실제 앱 페이지로 리다이렉트 -->
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
