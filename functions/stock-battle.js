/**
 * 주식 배틀 시뮬레이터 Cloud Functions
 *
 * - stockBattle     : Yahoo Finance 프록시 API
 * - stockBattleOg   : OG 카드 이미지 생성 (VS 스타일)
 * - stockBattleView : 동적 OG HTML 서빙 → /tools/stock-battle 리다이렉트
 */

const { onRequest } = require("firebase-functions/v2/https");
const sharp = require("sharp");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();

const SITE_URL = "https://suile-21173.web.app";
const OG_W = 600;

// ── 종목 이름 매핑 (확대) ──
const TICKER_NAMES = {
  // 미국
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
  MRVL: "Marvell", SMCI: "Super Micro", DELL: "Dell",
  CRWD: "CrowdStrike", PANW: "Palo Alto Networks",
  NOW: "ServiceNow", SNOW: "Snowflake", NET: "Cloudflare",
  RBLX: "Roblox", RIVN: "Rivian", LCID: "Lucid",
  SOFI: "SoFi", TSM: "TSMC", ASML: "ASML",
  BABA: "Alibaba", NIO: "NIO",
  SERV: "Serve Robotics", RR: "Richtech Robotics",
  RBOT: "Vicarious Surgical", IRBT: "iRobot",
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF",
  "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum",
  // 한국
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스",
  "373220.KS": "LG에너지솔루션", "005380.KS": "현대자동차",
  "000270.KS": "기아", "035420.KS": "NAVER", "035720.KS": "카카오",
  "051910.KS": "LG화학", "006400.KS": "삼성SDI", "068270.KS": "셀트리온",
  "105560.KS": "KB금융", "055550.KS": "신한지주", "066570.KS": "LG전자",
  "003670.KS": "포스코퓨처엠", "247540.KS": "에코프로비엠",
  "086520.KS": "에코프로", "352820.KS": "하이브", "259960.KS": "크래프톤",
  "036570.KS": "엔씨소프트", "251270.KS": "넷마블",
};

// ── 종목 도메인 매핑 (로고용) ──
const TICKER_DOMAINS = {
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com",
  AMZN: "amazon.com", NVDA: "nvidia.com", TSLA: "tesla.com",
  META: "meta.com", NFLX: "netflix.com", AMD: "amd.com",
  INTC: "intel.com", AVGO: "broadcom.com", CRM: "salesforce.com",
  ORCL: "oracle.com", ADBE: "adobe.com", CSCO: "cisco.com",
  QCOM: "qualcomm.com", UBER: "uber.com", ABNB: "airbnb.com",
  COIN: "coinbase.com", SHOP: "shopify.com", SNAP: "snap.com",
  SPOT: "spotify.com", DIS: "disney.com", PYPL: "paypal.com",
  V: "visa.com", MA: "mastercard.com", JPM: "jpmorgan.com",
  BAC: "bankofamerica.com", WMT: "walmart.com", COST: "costco.com",
  NKE: "nike.com", SBUX: "starbucks.com", MCD: "mcdonalds.com",
  KO: "coca-cola.com", PEP: "pepsico.com",
  MU: "micron.com", PLTR: "palantir.com", ARM: "arm.com",
  MRVL: "marvell.com", SMCI: "supermicro.com", DELL: "dell.com",
  CRWD: "crowdstrike.com", PANW: "paloaltonetworks.com",
  NOW: "servicenow.com", SNOW: "snowflake.com", NET: "cloudflare.com",
  RBLX: "roblox.com", RIVN: "rivian.com", LCID: "lucidmotors.com",
  SOFI: "sofi.com", TSM: "tsmc.com", ASML: "asml.com",
  BABA: "alibaba.com", NIO: "nio.com",
  SERV: "serverobotics.com", RR: "richtechrobotics.com",
  RBOT: "vicarioussurgical.com", IRBT: "irobot.com",
  BA: "boeing.com",
  GS: "goldmansachs.com", SPY: "ssga.com", QQQ: "invesco.com",
  "BTC-USD": "bitcoin.org", "ETH-USD": "ethereum.org",
  "005930.KS": "samsung.com", "000660.KS": "skhynix.com",
  "373220.KS": "lgensol.com", "005380.KS": "hyundai.com",
  "000270.KS": "kia.com", "035420.KS": "navercorp.com",
  "035720.KS": "kakaocorp.com", "051910.KS": "lgchem.com",
  "006400.KS": "samsungsdi.com", "068270.KS": "celltrion.com",
  "066570.KS": "lge.co.kr", "352820.KS": "hybecorp.com",
  "259960.KS": "krafton.com", "036570.KS": "ncsoft.com",
  "251270.KS": "netmarble.com",
};

function getName(ticker) {
  return TICKER_NAMES[ticker] || ticker;
}

function getLogoDomain(ticker) {
  return TICKER_DOMAINS[ticker] || null;
}

/** 로고 이미지 fetch → 48x48 PNG buffer (실패시 null) */
async function fetchLogo(ticker) {
  const domain = getLogoDomain(ticker);
  if (!domain) return null;
  const url = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // 48x48 원형으로 리사이즈
    return await sharp(buf)
      .resize(48, 48, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** 금액 포맷 */
function formatKRW(n) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(0)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

/** 기간 계산 (년/개월) */
function calcPeriod(from, to) {
  const d1 = new Date(from);
  const d2 = new Date(to);
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (months >= 12) {
    const years = Math.round(months / 12 * 10) / 10;
    return years === Math.floor(years) ? `${Math.floor(years)}년` : `${years}년`;
  }
  return `${months}개월`;
}

// ============================================
// 0-a) stockSearch - Yahoo Finance 종목 검색 API
// GET /api/stockSearch?q=robotics
// ============================================

// ============================================
// 0-b) stockHistory - 단일 종목 과거 데이터 API
// GET /api/stockHistory?ticker=AAPL&from=2015-01-01&to=2025-01-01
// ============================================
exports.stockHistory = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const { ticker, from, to } = req.query;
    if (!ticker || !from || !to) {
      res.status(400).json({ error: "Missing parameters: ticker, from, to" });
      return;
    }

    try {
      const data = await yahooFinance.historical(String(ticker), {
        period1: String(from),
        period2: String(to),
        interval: "1d",
      });
      const prices = data.map((d) => ({
        date: d.date.toISOString().split("T")[0],
        close: d.close,
      }));
      res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.json({
        ticker: String(ticker),
        name: getName(String(ticker)),
        prices,
      });
    } catch (err) {
      console.error("Stock history fetch failed:", err);
      res.status(500).json({ error: "Failed to fetch stock data", detail: err.message });
    }
  }
);

// ============================================
// 0-c) stockSearch
// ============================================
exports.stockSearch = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(400).json({ error: "Missing query parameter: q" });
      return;
    }

    try {
      const result = await yahooFinance.search(q, { newsCount: 0 });
      const quotes = (result.quotes || [])
        .filter((item) => item.isYahooFinance && (item.quoteType === "EQUITY" || item.quoteType === "ETF" || item.quoteType === "CRYPTOCURRENCY"))
        .slice(0, 10)
        .map((item) => ({
          ticker: item.symbol,
          name: item.shortname || item.longname || item.symbol,
          exchange: item.exchange || "",
          type: item.quoteType,
        }));

      res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.json({ results: quotes });
    } catch (err) {
      console.error("Stock search failed:", err);
      res.status(500).json({ error: "Search failed", detail: err.message });
    }
  }
);

// ============================================
// 1) stockBattle - Yahoo Finance 프록시 API
// ============================================
exports.stockBattle = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const { a, b, from, to } = req.query;
    if (!a || !b || !from || !to) {
      res.status(400).json({ error: "Missing parameters: a, b, from, to" });
      return;
    }

    try {
      const [dataA, dataB] = await Promise.all([
        yahooFinance.historical(String(a), { period1: String(from), period2: String(to), interval: "1d" }),
        yahooFinance.historical(String(b), { period1: String(from), period2: String(to), interval: "1d" }),
      ]);
      const fmt = (data) => data.map((d) => ({ date: d.date.toISOString().split("T")[0], close: d.close }));
      res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.json({
        a: { ticker: String(a), name: getName(String(a)), prices: fmt(dataA) },
        b: { ticker: String(b), name: getName(String(b)), prices: fmt(dataB) },
      });
    } catch (err) {
      console.error("Stock battle fetch failed:", err);
      res.status(500).json({ error: "Failed to fetch stock data", detail: err.message });
    }
  }
);

// ============================================
// 2) stockBattleOg - OG 카드 이미지 생성
// GET /stockBattleOg?a=AAPL&b=MSFT&amt=1000000&from=2020-01-01&to=2025-01-01
// ============================================
// 로고 자리를 포함한 SVG (로고는 sharp composite로 별도 합성)
// 로고 위치: A = (151-24, 88) = (127, 88), B = (449-24, 88) = (425, 88) → 48x48
const LOGO_SIZE = 48;
const LOGO_A_X = 151 - LOGO_SIZE / 2; // 127
const LOGO_A_Y = 82;
const LOGO_B_X = OG_W - 151 - LOGO_SIZE / 2; // 425
const LOGO_B_Y = 82;

function buildStockBattleSvg(a, b, amt, from, to) {
  const nameA = escXml(getName(a));
  const nameB = escXml(getName(b));
  const tickerA = escXml(a);
  const tickerB = escXml(b);
  const period = escXml(calcPeriod(from, to));
  const amtText = escXml(`${formatKRW(parseInt(amt) || 1000000)}원`);
  const initA = nameA.charAt(0).toUpperCase();
  const initB = nameB.charAt(0).toUpperCase();

  const H = 370;

  return {
    svg: `<svg width="${OG_W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_W}" height="${H}" fill="#18181b"/>
  <rect x="16" y="16" width="${OG_W - 32}" height="${H - 32}" rx="20" fill="#27272a"/>

  <!-- 상단 배지 -->
  <rect x="${OG_W / 2 - 55}" y="30" width="110" height="26" rx="13" fill="#10b981"/>
  <text x="${OG_W / 2}" y="48" text-anchor="middle" font-size="13" font-weight="bold" fill="white" font-family="sans-serif">STOCK BATTLE</text>

  <!-- 좌측 카드 -->
  <rect x="36" y="72" width="230" height="150" rx="16" fill="#052e16" opacity="0.5"/>
  <rect x="36" y="72" width="230" height="150" rx="16" fill="none" stroke="#10b981" stroke-width="2"/>
  <!-- 로고 placeholder (원형 배경) -->
  <circle cx="151" cy="${LOGO_A_Y + LOGO_SIZE / 2}" r="28" fill="#064e3b"/>
  <text x="151" y="${LOGO_A_Y + LOGO_SIZE / 2 + 7}" text-anchor="middle" font-size="22" font-weight="bold" fill="#6ee7b7" font-family="sans-serif">${initA}</text>
  <!-- 이름 -->
  <text x="151" y="152" text-anchor="middle" font-size="24" font-weight="900" fill="#4ade80" font-family="sans-serif">${nameA}</text>
  <text x="151" y="175" text-anchor="middle" font-size="14" fill="#6ee7b7" font-family="monospace" font-weight="bold">${tickerA}</text>
  <text x="151" y="200" text-anchor="middle" font-size="11" fill="#a7f3d0" font-family="sans-serif" opacity="0.6">PLAYER 1</text>

  <!-- 중앙 VS -->
  <circle cx="${OG_W / 2}" cy="147" r="26" fill="#3f3f46"/>
  <text x="${OG_W / 2}" y="155" text-anchor="middle" font-size="22" font-weight="900" fill="#fafafa" font-family="sans-serif">VS</text>

  <!-- 우측 카드 -->
  <rect x="${OG_W - 266}" y="72" width="230" height="150" rx="16" fill="#1e1b4b" opacity="0.5"/>
  <rect x="${OG_W - 266}" y="72" width="230" height="150" rx="16" fill="none" stroke="#6366f1" stroke-width="2"/>
  <!-- 로고 placeholder (원형 배경) -->
  <circle cx="${OG_W - 151}" cy="${LOGO_B_Y + LOGO_SIZE / 2}" r="28" fill="#312e81"/>
  <text x="${OG_W - 151}" y="${LOGO_B_Y + LOGO_SIZE / 2 + 7}" text-anchor="middle" font-size="22" font-weight="bold" fill="#a5b4fc" font-family="sans-serif">${initB}</text>
  <!-- 이름 -->
  <text x="${OG_W - 151}" y="152" text-anchor="middle" font-size="24" font-weight="900" fill="#a5b4fc" font-family="sans-serif">${nameB}</text>
  <text x="${OG_W - 151}" y="175" text-anchor="middle" font-size="14" fill="#c7d2fe" font-family="monospace" font-weight="bold">${tickerB}</text>
  <text x="${OG_W - 151}" y="200" text-anchor="middle" font-size="11" fill="#c7d2fe" font-family="sans-serif" opacity="0.6">PLAYER 2</text>

  <!-- 하단 후크 -->
  <text x="${OG_W / 2}" y="262" text-anchor="middle" font-size="22" font-weight="bold" fill="#fafafa" font-family="sans-serif">${amtText}을 ${period}동안 투자했다면?</text>
  <text x="${OG_W / 2}" y="290" text-anchor="middle" font-size="14" fill="#71717a" font-family="sans-serif">어떤 종목이 승리했을까요? 지금 확인해보세요!</text>

  <!-- 브랜드 -->
  <text x="${OG_W / 2}" y="335" text-anchor="middle" font-size="13" font-weight="bold" fill="#3f3f46" font-family="sans-serif">SUILE</text>
</svg>`,
    height: H,
  };
}

exports.stockBattleOg = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    const { a, b, amt, from, to } = req.query;
    if (!a || !b) {
      res.status(400).send("Missing ticker parameters");
      return;
    }

    try {
      const tickerA = String(a);
      const tickerB = String(b);

      // SVG 베이스 + 로고 병렬 fetch
      const { svg, height } = buildStockBattleSvg(
        tickerA, tickerB,
        String(amt || "1000000"),
        String(from || "2020-01-01"),
        String(to || "2025-01-01")
      );

      const [logoA, logoB] = await Promise.all([
        fetchLogo(tickerA),
        fetchLogo(tickerB),
      ]);

      // SVG → PNG 베이스 이미지
      let image = sharp(Buffer.from(svg)).resize(OG_W, height).png();

      // 로고 합성 (있는 것만)
      const composites = [];
      if (logoA) {
        composites.push({ input: logoA, left: LOGO_A_X, top: LOGO_A_Y });
      }
      if (logoB) {
        composites.push({ input: logoB, left: LOGO_B_X, top: LOGO_B_Y });
      }

      let result;
      if (composites.length > 0) {
        result = await image.toBuffer();
        result = await sharp(result).composite(composites).png().toBuffer();
      } else {
        result = await image.toBuffer();
      }

      res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
      res.set("Content-Type", "image/png");
      res.send(result);
    } catch (err) {
      console.error("Stock battle OG image failed:", err);
      res.status(500).send("Image generation failed");
    }
  }
);

// ============================================
// 3) stockBattleView - 동적 OG HTML 서빙
// GET /sb?a=AAPL&b=MSFT&from=2020-01-01&to=2025-01-01&amt=1000000
// ============================================
exports.stockBattleView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 20 },
  async (req, res) => {
    const { a, b, from, to, amt } = req.query;

    if (!a || !b) {
      res.redirect("/tools/stock-battle");
      return;
    }

    const nameA = escXml(getName(String(a)));
    const nameB = escXml(getName(String(b)));
    const amount = parseInt(amt) || 1000000;
    const period = calcPeriod(String(from || "2020-01-01"), String(to || "2025-01-01"));

    const title = `${nameA} vs ${nameB} - 주식 배틀`;
    const description = `${formatKRW(amount)}원을 ${period}동안 투자했다면? 어떤 종목이 승리했을까?`;

    const ogParams = new URLSearchParams({
      a: String(a), b: String(b),
      amt: String(amount),
      from: String(from || "2020-01-01"),
      to: String(to || "2025-01-01"),
    });
    const ogImageUrl = `https://asia-northeast3-suile-21173.cloudfunctions.net/stockBattleOg?${ogParams.toString()}`;

    // 실제 앱 페이지로 리다이렉트할 URL
    const appParams = new URLSearchParams({
      a: String(a), b: String(b),
      from: String(from || "2020-01-01"),
      to: String(to || "2025-01-01"),
      amt: String(amount),
    });
    const appUrl = `/tools/stock-battle?${appParams.toString()}`;
    const pageUrl = `${SITE_URL}/sb?${ogParams.toString()}`;

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
  <meta property="og:image:height" content="370"/>
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
    <p>배틀 준비중...</p>
  </div>
  <script>window.location.replace('${appUrl}');</script>
</body>
</html>`;

    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }
);
