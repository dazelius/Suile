/**
 * 몬테카를로 시뮬레이터 Cloud Functions
 *
 * - monteCarloOg   : OG 카드 이미지 생성
 * - monteCarloView : 동적 OG HTML 서빙 → /tools/monte-carlo 리다이렉트
 */

const { onRequest } = require("firebase-functions/v2/https");
const sharp = require("sharp");

const SITE_URL = "https://suile-21173.web.app";
const OG_W = 600;
const OG_H = 340;

// ── 종목 이름 매핑 (공용) ──
const TICKER_NAMES = {
  AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Google", AMZN: "Amazon",
  NVDA: "NVIDIA", TSLA: "Tesla", META: "Meta", NFLX: "Netflix",
  AMD: "AMD", INTC: "Intel", AVGO: "Broadcom", CRM: "Salesforce",
  ORCL: "Oracle", ADBE: "Adobe", CSCO: "Cisco", QCOM: "Qualcomm",
  UBER: "Uber", ABNB: "Airbnb", COIN: "Coinbase", SHOP: "Shopify",
  SNAP: "Snap", SPOT: "Spotify", DIS: "Disney", PYPL: "PayPal",
  V: "Visa", MA: "Mastercard", JPM: "JPMorgan", BAC: "Bank of America",
  WMT: "Walmart", COST: "Costco", NKE: "Nike", SBUX: "Starbucks",
  MCD: "McDonald's", KO: "Coca-Cola", PEP: "PepsiCo",
  MU: "Micron", PLTR: "Palantir", ARM: "ARM Holdings",
  SERV: "Serve Robotics", RR: "Richtech Robotics",
  TSM: "TSMC", ASML: "ASML", BABA: "Alibaba", NIO: "NIO",
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF",
  "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum",
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스",
  "035420.KS": "NAVER", "035720.KS": "카카오",
  "005380.KS": "현대자동차", "000270.KS": "기아",
  "352820.KS": "하이브", "259960.KS": "크래프톤",
};

// ── 종목 도메인 매핑 (로고용) ──
const TICKER_DOMAINS = {
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com",
  AMZN: "amazon.com", NVDA: "nvidia.com", TSLA: "tesla.com",
  META: "meta.com", NFLX: "netflix.com", AMD: "amd.com",
  INTC: "intel.com", CRM: "salesforce.com", DIS: "disney.com",
  V: "visa.com", MA: "mastercard.com", JPM: "jpmorgan.com",
  MU: "micron.com", PLTR: "palantir.com", ARM: "arm.com",
  TSM: "tsmc.com", ASML: "asml.com", BABA: "alibaba.com",
  SERV: "serverobotics.com", RR: "richtechrobotics.com",
  "005930.KS": "samsung.com", "035420.KS": "navercorp.com",
  "035720.KS": "kakaocorp.com", "005380.KS": "hyundai.com",
};

function getName(ticker) {
  return TICKER_NAMES[ticker] || ticker;
}

function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function formatKRW(n) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(0)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

/** 로고 이미지 fetch → 56x56 PNG buffer (실패시 null) */
async function fetchLogo(ticker) {
  const domain = TICKER_DOMAINS[ticker] || null;
  if (!domain) return null;
  const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf)
      .resize(56, 56, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

// ============================================
// 1) monteCarloOg - OG 카드 이미지 생성
// GET /monteCarloOg?ticker=NVDA&amt=1000000&fy=3
// ============================================
function buildMonteCarloSvg(ticker, amt, fy) {
  const name = escXml(getName(ticker));
  const tickerEsc = escXml(ticker);
  const amtText = escXml(`${formatKRW(parseInt(amt) || 1000000)}원`);
  const fyText = escXml(`${fy}년`);
  const initial = name.charAt(0).toUpperCase();

  // 로고 위치
  const logoCx = OG_W / 2;
  const logoCy = 100;

  return `<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_W}" height="${OG_H}" fill="#18181b"/>
  <rect x="16" y="16" width="${OG_W - 32}" height="${OG_H - 32}" rx="20" fill="#27272a"/>

  <!-- 상단 배지 -->
  <rect x="${OG_W / 2 - 80}" y="28" width="160" height="26" rx="13" fill="#7c3aed"/>
  <text x="${OG_W / 2}" y="46" text-anchor="middle" font-size="12" font-weight="bold" fill="white" font-family="sans-serif">MONTE CARLO SIMULATOR</text>

  <!-- 로고 원형 배경 -->
  <circle cx="${logoCx}" cy="${logoCy}" r="32" fill="#4c1d95"/>
  <text x="${logoCx}" y="${logoCy + 8}" text-anchor="middle" font-size="26" font-weight="bold" fill="#c4b5fd" font-family="sans-serif">${initial}</text>

  <!-- 종목명 -->
  <text x="${OG_W / 2}" y="156" text-anchor="middle" font-size="30" font-weight="900" fill="#e9d5ff" font-family="sans-serif">${name}</text>
  <text x="${OG_W / 2}" y="180" text-anchor="middle" font-size="14" fill="#a78bfa" font-family="monospace" font-weight="bold">${tickerEsc}</text>

  <!-- 메인 후크 문구 -->
  <text x="${OG_W / 2}" y="222" text-anchor="middle" font-size="24" font-weight="bold" fill="#fafafa" font-family="sans-serif">${amtText} 넣으면 ${fyText} 후에...</text>

  <!-- 서브텍스트 -->
  <text x="${OG_W / 2}" y="252" text-anchor="middle" font-size="15" fill="#a78bfa" font-family="sans-serif">돈 벌 확률은? 투자 등급은?</text>
  <text x="${OG_W / 2}" y="274" text-anchor="middle" font-size="13" fill="#71717a" font-family="sans-serif">2,000가지 시나리오 AI 예측 결과 보기</text>

  <!-- 하단 장식 점 3개 -->
  <circle cx="${OG_W / 2 - 20}" cy="285" r="3" fill="#7c3aed" opacity="0.6"/>
  <circle cx="${OG_W / 2}" cy="285" r="3" fill="#7c3aed"/>
  <circle cx="${OG_W / 2 + 20}" cy="285" r="3" fill="#7c3aed" opacity="0.6"/>

  <!-- 브랜드 -->
  <text x="${OG_W / 2}" y="310" text-anchor="middle" font-size="13" font-weight="bold" fill="#3f3f46" font-family="sans-serif">SUILE</text>
</svg>`;
}

exports.monteCarloOg = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    const { ticker, amt, fy } = req.query;
    if (!ticker) {
      res.status(400).send("Missing ticker parameter");
      return;
    }

    try {
      const svg = buildMonteCarloSvg(
        String(ticker),
        String(amt || "1000000"),
        String(fy || "3")
      );

      // 로고 fetch
      const logo = await fetchLogo(String(ticker));

      // SVG → PNG
      let result = await sharp(Buffer.from(svg)).resize(OG_W, OG_H).png().toBuffer();

      // 로고 합성
      if (logo) {
        result = await sharp(result)
          .composite([{
            input: logo,
            left: Math.round(OG_W / 2 - 28), // 56/2
            top: Math.round(100 - 28), // logoCy - 28
          }])
          .png()
          .toBuffer();
      }

      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.set("Content-Type", "image/png");
      res.send(result);
    } catch (err) {
      console.error("Monte Carlo OG image failed:", err);
      res.status(500).send("Image generation failed");
    }
  }
);

// ============================================
// 2) monteCarloView - 동적 OG HTML 서빙
// GET /mc?ticker=NVDA&amt=1000000&fy=3&ly=5
// ============================================
exports.monteCarloView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 10 },
  async (req, res) => {
    const { ticker, amt, fy, ly } = req.query;
    if (!ticker) {
      res.redirect(302, `${SITE_URL}/tools/monte-carlo`);
      return;
    }

    const name = getName(String(ticker));
    const amount = parseInt(String(amt)) || 1000000;
    const forecastYears = String(fy || "3");

    const title = `${name}에 ${formatKRW(amount)}원 넣으면 ${forecastYears}년 후에...`;
    const description = `2,000가지 시나리오로 예측한 결과! 돈 벌 확률은? ${name}의 투자 등급은? 지금 확인하세요 🔥`;

    const ogParams = new URLSearchParams({
      ticker: String(ticker),
      amt: String(amount),
      fy: forecastYears,
    });
    const ogImageUrl = `https://asia-northeast3-suile-21173.cloudfunctions.net/monteCarloOg?${ogParams.toString()}`;

    const appParams = new URLSearchParams({
      ticker: String(ticker),
      amt: String(amount),
      fy: forecastYears,
      ly: String(ly || "5"),
    });
    const appUrl = `/tools/monte-carlo?${appParams.toString()}`;
    const pageUrl = `${SITE_URL}/mc?${ogParams.toString()}`;

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} | SUILE</title>
  <meta name="description" content="${description}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${description}"/>
  <meta property="og:image" content="${ogImageUrl}"/>
  <meta property="og:image:width" content="${OG_W}"/>
  <meta property="og:image:height" content="${OG_H}"/>
  <meta property="og:url" content="${pageUrl}"/>
  <meta property="og:site_name" content="SUILE"/>
  <meta property="og:locale" content="ko_KR"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${description}"/>
  <meta name="twitter:image" content="${ogImageUrl}"/>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1349078633848665" crossorigin="anonymous"></script>
  <meta http-equiv="refresh" content="0;url=${appUrl}"/>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#71717a;">
    <p>시뮬레이션 준비중...</p>
  </div>
  <script>window.location.replace('${appUrl}');</script>
</body>
</html>`;

    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }
);
