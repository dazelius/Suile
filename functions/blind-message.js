/**
 * 블라인드 메시지 Cloud Functions
 * - ogImage: OG 카드 이미지 생성 (블라인드 텍스트 스타일)
 * - messageView: 동적 OG meta 태그 HTML 서빙 + /m 리다이렉트
 */

const { onRequest } = require("firebase-functions/v2/https");
const sharp = require("sharp");

const CARD_WIDTH = 600;
const SITE_URL = "https://suile-21173.web.app";

// ── 유틸리티 ──

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

function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function blindMessage(message) {
  const chars = [...message];
  const textIndices = chars
    .map((c, i) => (/\s/.test(c) ? -1 : i))
    .filter((i) => i !== -1);
  const revealCount = Math.max(1, Math.floor(textIndices.length * 0.2));
  const seed = message.length * 7 + (message.charCodeAt(0) || 0) * 13;
  const shuffled = textIndices.slice().sort((a, b) => {
    const ha = ((a + seed) * 2654435761) >>> 0;
    const hb = ((b + seed) * 2654435761) >>> 0;
    return ha - hb;
  });
  const revealSet = new Set(shuffled.slice(0, revealCount));
  return chars
    .map((c, i) => (/\s/.test(c) ? c : revealSet.has(i) ? c : "■"))
    .join("");
}

function splitBlindLines(blind, maxChars = 22) {
  const rawLines = blind.split(/\n/);
  const result = [];
  for (const raw of rawLines) {
    if (raw.length <= maxChars) {
      result.push(raw);
    } else {
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
  return result.slice(0, 6);
}

function buildOgSvg(from, to, message) {
  const hasFrom = from && from !== "익명" && from.length > 0;
  const hasTo = to && to.length > 0;

  let headerText = "블라인드 메시지가 도착했어요";
  if (hasFrom && hasTo) {
    headerText = `${escXml(from)}님이 ${escXml(to)}님에게`;
  } else if (hasFrom) {
    headerText = `${escXml(from)}님이 보낸 메시지`;
  } else if (hasTo) {
    headerText = `${escXml(to)}님에게 온 메시지`;
  }

  const blind = blindMessage(message || "비밀 메시지");
  const blindLines = splitBlindLines(blind, 9);
  const blindStartY = 240;
  const blindLineHeight = 76;

  const blindTexts = blindLines
    .map(
      (line, i) =>
        `<text x="${CARD_WIDTH / 2}" y="${blindStartY + i * blindLineHeight}" text-anchor="middle" font-size="60" font-weight="bold" fill="#a1a1aa" font-family="monospace" letter-spacing="6">${escXml(line)}</text>`
    )
    .join("\n    ");

  const footerY = Math.max(blindStartY + blindLines.length * blindLineHeight + 40, 460);
  const actualHeight = footerY + 50;

  return {
    svg: `<svg width="${CARD_WIDTH}" height="${actualHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${CARD_WIDTH}" height="${actualHeight}" rx="0" fill="#18181b"/>
  <rect x="20" y="20" width="${CARD_WIDTH - 40}" height="${actualHeight - 40}" rx="20" fill="#27272a"/>
  <circle cx="${CARD_WIDTH / 2}" cy="68" r="28" fill="#3f3f46"/>
  <rect x="${CARD_WIDTH / 2 - 10}" y="62" width="20" height="14" rx="3" fill="#a1a1aa"/>
  <path d="M${CARD_WIDTH / 2 - 6} 62 V57 a6 6 0 0 1 12 0 V62" fill="none" stroke="#a1a1aa" stroke-width="3" stroke-linecap="round"/>
  <text x="${CARD_WIDTH / 2}" y="130" text-anchor="middle" font-size="26" font-weight="bold" fill="#fafafa" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">${headerText}</text>
  <line x1="50" y1="155" x2="${CARD_WIDTH - 50}" y2="155" stroke="#3f3f46" stroke-width="1"/>
  <text x="${CARD_WIDTH / 2}" y="190" text-anchor="middle" font-size="18" fill="#71717a" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">제가 하고 싶은 말은...</text>
  ${blindTexts}
  <text x="${CARD_WIDTH / 2}" y="${footerY}" text-anchor="middle" font-size="14" fill="#52525b" font-family="'Pretendard','Apple SD Gothic Neo',sans-serif">링크를 열어 비밀 메시지를 확인하세요</text>
  <text x="${CARD_WIDTH / 2}" y="${footerY + 24}" text-anchor="middle" font-size="13" font-weight="bold" fill="#3f3f46" font-family="'Geist','Pretendard',sans-serif">SUILE</text>
</svg>`,
    height: actualHeight,
  };
}

// ── Cloud Functions ──

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

    const title = hasTo
      ? `${escXml(data.to)}님에게 블라인드 메시지가 도착했어요`
      : "블라인드 메시지가 도착했어요";
    const description = "제가 하고 싶은 말은...";
    const ogImageUrl = `https://asia-northeast3-suile-21173.cloudfunctions.net/ogImage?d=${encodeURIComponent(encoded)}`;
    const pageUrl = `${SITE_URL}/v?d=${encodeURIComponent(encoded)}`;

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
  <title>${title} | SUILE</title>
  <meta name="description" content="${description}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${ogImageUrl}"/>
  <meta property="og:image:width" content="${CARD_WIDTH}"/>
  <meta property="og:image:height" content="400"/>
  <meta property="og:url" content="${pageUrl}"/>
  <meta property="og:site_name" content="SUILE"/>
  <meta property="og:locale" content="ko_KR"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="${ogImageUrl}"/>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1349078633848665" crossorigin="anonymous"></script>
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
