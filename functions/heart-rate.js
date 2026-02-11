/**
 * 심박수 측정기 Cloud Functions
 *
 * - heartRateOg   : 동적 OG 이미지 생성
 * - heartRateView : 동적 OG HTML + 리다이렉트
 */

const { onRequest } = require("firebase-functions/v2/https");
const sharp = require("sharp");

const SITE_URL = "https://suile-21173.web.app";
const OG_W = 1200;
const OG_H = 630;

function escXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getStatusLabel(status) {
  if (status === "bradycardia") return "서맥";
  if (status === "tachycardia") return "빈맥";
  return "정상";
}

function getStatusColor(status) {
  if (status === "bradycardia") return "#3b82f6";
  if (status === "tachycardia") return "#ef4444";
  return "#10b981";
}

// ============================================
// heartRateOg - 동적 OG 이미지
// GET /heartRateOg?bpm=72&status=normal
// ============================================
exports.heartRateOg = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    const bpm = escXml(String(req.query.bpm || "??"));
    const status = String(req.query.status || "normal");
    const statusLabel = escXml(getStatusLabel(status));
    const statusColor = getStatusColor(status);

    // 심전도 파형 SVG 패스 (장식용)
    const waveY = 400;
    const wavePoints = [];
    for (let x = 0; x < OG_W; x += 3) {
      const t = x / OG_W;
      // 심전도 스타일: 평탄 + 급격한 피크
      let y = waveY;
      const cycle = (t * 6) % 1;
      if (cycle > 0.35 && cycle < 0.4) y = waveY - 60;
      else if (cycle > 0.4 && cycle < 0.42) y = waveY + 25;
      else if (cycle > 0.42 && cycle < 0.48) y = waveY - 120;
      else if (cycle > 0.48 && cycle < 0.52) y = waveY + 30;
      else if (cycle > 0.52 && cycle < 0.56) y = waveY - 15;
      else y = waveY + Math.sin(x * 0.02) * 3;
      wavePoints.push(`${x},${y}`);
    }
    const wavePath = wavePoints.join(" ");

    const svg = Buffer.from(`<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <!-- 배경 -->
  <rect width="${OG_W}" height="${OG_H}" fill="#18181b"/>
  <rect x="16" y="16" width="${OG_W - 32}" height="${OG_H - 32}" rx="20" fill="#1f1f23"/>

  <!-- 그리드 -->
  ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 60}" y1="16" x2="${i * 60}" y2="${OG_H - 16}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`).join("")}
  ${Array.from({ length: 10 }, (_, i) => `<line x1="16" y1="${i * 63}" x2="${OG_W - 16}" y2="${i * 63}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`).join("")}

  <!-- 심전도 파형 -->
  <polyline points="${wavePath}" fill="none" stroke="${statusColor}" stroke-width="2.5" opacity="0.3"/>

  <!-- 상단 배지 -->
  <rect x="${OG_W / 2 - 90}" y="45" width="180" height="32" rx="16" fill="${statusColor}" opacity="0.9"/>
  <text x="${OG_W / 2}" y="67" text-anchor="middle" font-size="14" font-weight="bold" fill="white" font-family="sans-serif">PPG Heart Rate Monitor</text>

  <!-- 하트 아이콘 (텍스트) -->
  <text x="${OG_W / 2}" y="165" text-anchor="middle" font-size="50" fill="${statusColor}" font-family="sans-serif">&#x2665;</text>

  <!-- BPM 숫자 -->
  <text x="${OG_W / 2}" y="285" text-anchor="middle" font-size="120" font-weight="900" fill="white" font-family="sans-serif">${bpm}</text>
  <text x="${OG_W / 2}" y="325" text-anchor="middle" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.5)" font-family="sans-serif">BPM</text>

  <!-- 상태 -->
  <rect x="${OG_W / 2 - 50}" y="355" width="100" height="30" rx="15" fill="${statusColor}" opacity="0.2"/>
  <text x="${OG_W / 2}" y="376" text-anchor="middle" font-size="16" font-weight="bold" fill="${statusColor}" font-family="sans-serif">${statusLabel}</text>

  <!-- 하단 브랜드 -->
  <line x1="${OG_W / 2 - 40}" y1="560" x2="${OG_W / 2 + 40}" y2="560" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <text x="${OG_W / 2}" y="590" text-anchor="middle" font-size="16" font-weight="bold" fill="rgba(255,255,255,0.4)" font-family="sans-serif">SUILE</text>
</svg>`);

    try {
      const result = await sharp(svg).resize(OG_W, OG_H).png().toBuffer();
      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.set("Content-Type", "image/png");
      res.send(result);
    } catch (err) {
      console.error("[HeartRateOg] Error:", err.message);
      res.status(500).send("Image generation failed");
    }
  }
);

// ============================================
// heartRateView - 동적 OG HTML
// GET /hr?bpm=72&status=normal
// ============================================
exports.heartRateView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 10 },
  async (req, res) => {
    const bpm = String(req.query.bpm || "");
    const status = String(req.query.status || "normal");

    if (!bpm) {
      res.redirect(302, `${SITE_URL}/tools/heart-rate`);
      return;
    }

    const statusLabel = getStatusLabel(status);
    const title = `심박수: ${bpm} BPM (${statusLabel})`;
    const description = `카메라로 측정한 심박수 ${bpm} BPM · ${statusLabel} — PPG 기술로 측정한 결과를 확인하세요!`;
    const ogImageUrl = `${SITE_URL}/heartRateOg?bpm=${encodeURIComponent(bpm)}&status=${encodeURIComponent(status)}`;
    const redirectUrl = `${SITE_URL}/tools/heart-rate`;

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
