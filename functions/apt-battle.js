/**
 * 아파트 배틀 Cloud Functions
 *
 * - aptSearch     : 국토교통부 실거래가 API로 아파트 검색
 * - aptBattle     : 두 아파트 가격 시계열 비교 데이터
 * - aptBattleOg   : OG 카드 이미지 생성
 * - aptBattleView : 동적 OG HTML → /tools/apt-battle 리다이렉트
 */

const { onRequest } = require("firebase-functions/v2/https");
const sharp = require("sharp");
const { XMLParser } = require("fast-xml-parser");

const SITE_URL = "https://suile-21173.web.app";
const MOLIT_BASE = "http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

const xmlParser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function getApiKey() {
  return process.env.MOLIT_API_KEY || "";
}

// ── 국토교통부 API 호출 ──
async function fetchMolitData(lawdCd, dealYmd) {
  const apiKey = getApiKey();
  const url = `${MOLIT_BASE}?serviceKey=${encodeURIComponent(apiKey)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=9999&pageNo=1`;
  const res = await fetch(url);
  const xml = await res.text();

  const parsed = xmlParser.parse(xml);
  const body = parsed?.response?.body;
  if (!body || !body.items) return [];

  const items = body.items.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// ── 가격 문자열 정규화 (공백, 쉼표 제거) ──
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  return parseInt(String(priceStr).replace(/[,\s]/g, ""), 10) || 0;
}

// m2 → 평 변환 (3.3058m2 = 1평)
function m2ToPyeong(m2) {
  return m2 / 3.3058;
}

// 만원 → 억원 포맷
function formatPrice(manwon) {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rest = manwon % 10000;
    return rest > 0 ? `${eok}억 ${rest}만` : `${eok}억`;
  }
  return `${manwon.toLocaleString()}만`;
}

// ============================================
// aptSearch - 아파트 검색
// GET /api/aptSearch?lawdCd=11680&q=래미안
// ============================================
exports.aptSearch = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10, timeoutSeconds: 30 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const lawdCd = String(req.query.lawdCd || "").trim();
    const q = String(req.query.q || "").trim();
    if (!lawdCd) {
      res.status(400).json({ error: "Missing lawdCd" });
      return;
    }

    try {
      // 최근 6개월 데이터에서 아파트 검색
      const now = new Date();
      const months = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      // 최근 3개월만 우선 fetch (속도 위해)
      const allItems = [];
      for (const m of months.slice(0, 3)) {
        try {
          const items = await fetchMolitData(lawdCd, m);
          allItems.push(...items);
        } catch { /* skip */ }
      }

      // 아파트별 그룹핑
      const aptMap = {};
      for (const item of allItems) {
        const name = String(item["아파트"] || item["aptNm"] || "").trim();
        if (!name) continue;
        // 검색 필터
        if (q && !name.includes(q)) continue;

        const area = parseFloat(item["전용면적"] || item["excluUseAr"] || 0);
        const areaRound = Math.round(area);
        const key = `${name}_${areaRound}`;

        if (!aptMap[key]) {
          aptMap[key] = {
            name,
            dong: String(item["법정동"] || item["umdNm"] || "").trim(),
            area: areaRound,
            buildYear: String(item["건축년도"] || item["buildYear"] || "").trim(),
            prices: [],
          };
        }
        const price = parsePrice(item["거래금액"] || item["dealAmount"]);
        const year = String(item["년"] || item["dealYear"] || "");
        const month = String(item["월"] || item["dealMonth"] || "").padStart(2, "0");
        const day = String(item["일"] || item["dealDay"] || "").padStart(2, "0");
        if (price > 0) {
          aptMap[key].prices.push({ price, date: `${year}-${month}-${day}` });
        }
      }

      // 결과 정리: 최근 거래가 기준 정렬
      const results = Object.values(aptMap)
        .filter((a) => a.prices.length > 0)
        .map((a) => {
          a.prices.sort((x, y) => y.date.localeCompare(x.date));
          const latest = a.prices[0];
          const pyeong = m2ToPyeong(a.area);
          return {
            name: a.name,
            dong: a.dong,
            area: a.area,
            buildYear: a.buildYear,
            recentPrice: latest.price,
            recentDate: latest.date,
            pricePerPyeong: Math.round(latest.price / pyeong),
            txCount: a.prices.length,
          };
        })
        .sort((a, b) => b.txCount - a.txCount) // 거래 많은 순
        .slice(0, 30);

      res.set("Cache-Control", "public, max-age=3600");
      res.json({ results });
    } catch (err) {
      console.error("aptSearch failed:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================
// aptBattle - 두 아파트 배틀 데이터
// GET /api/aptBattle?lawdCdA=11680&aptA=래미안&areaA=84&lawdCdB=11650&aptB=자이&areaB=84&years=5
// ============================================
exports.aptBattle = onRequest(
  { region: "asia-northeast3", memory: "512MiB", maxInstances: 10, timeoutSeconds: 120 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const lawdCdA = String(req.query.lawdCdA || "").trim();
    const aptA = String(req.query.aptA || "").trim();
    const areaA = parseInt(req.query.areaA) || 84;
    const lawdCdB = String(req.query.lawdCdB || "").trim();
    const aptB = String(req.query.aptB || "").trim();
    const areaB = parseInt(req.query.areaB) || 84;
    const years = Math.min(parseInt(req.query.years) || 5, 10);

    if (!lawdCdA || !aptA || !lawdCdB || !aptB) {
      res.status(400).json({ error: "Missing parameters" });
      return;
    }

    try {
      // 분기별 데이터 수집 (1, 4, 7, 10월)
      const now = new Date();
      const months = [];
      for (let y = 0; y < years; y++) {
        for (const m of [1, 4, 7, 10]) {
          const d = new Date(now.getFullYear() - y, m - 1, 1);
          if (d <= now) {
            months.push(`${d.getFullYear()}${String(m).padStart(2, "0")}`);
          }
        }
      }
      months.sort();

      // 같은 시군구면 한 번만 fetch
      const sameRegion = lawdCdA === lawdCdB;
      const cache = {}; // dealYmd → items[]

      async function fetchCached(lawdCd, dealYmd) {
        const key = `${lawdCd}_${dealYmd}`;
        if (cache[key]) return cache[key];
        try {
          const items = await fetchMolitData(lawdCd, dealYmd);
          cache[key] = items;
          return items;
        } catch {
          cache[key] = [];
          return [];
        }
      }

      // A 데이터 수집
      const pricesA = [];
      for (const m of months) {
        const items = await fetchCached(lawdCdA, m);
        const filtered = items.filter((item) => {
          const name = String(item["아파트"] || item["aptNm"] || "").trim();
          const area = Math.round(parseFloat(item["전용면적"] || item["excluUseAr"] || 0));
          return name === aptA && Math.abs(area - areaA) <= 3; // 면적 ±3m2 허용
        });
        for (const item of filtered) {
          const price = parsePrice(item["거래금액"] || item["dealAmount"]);
          const year = String(item["년"] || item["dealYear"] || "");
          const month = String(item["월"] || item["dealMonth"] || "").padStart(2, "0");
          if (price > 0) {
            pricesA.push({ date: `${year}-${month}`, price });
          }
        }
      }

      // B 데이터 수집
      const pricesB = [];
      for (const m of months) {
        const items = await fetchCached(lawdCdB, m);
        const filtered = items.filter((item) => {
          const name = String(item["아파트"] || item["aptNm"] || "").trim();
          const area = Math.round(parseFloat(item["전용면적"] || item["excluUseAr"] || 0));
          return name === aptB && Math.abs(area - areaB) <= 3;
        });
        for (const item of filtered) {
          const price = parsePrice(item["거래금액"] || item["dealAmount"]);
          const year = String(item["년"] || item["dealYear"] || "");
          const month = String(item["월"] || item["dealMonth"] || "").padStart(2, "0");
          if (price > 0) {
            pricesB.push({ date: `${year}-${month}`, price });
          }
        }
      }

      // 월별 평균 가격 (같은 월 여러 거래 평균)
      function aggregateMonthly(prices, area) {
        const byMonth = {};
        for (const p of prices) {
          if (!byMonth[p.date]) byMonth[p.date] = [];
          byMonth[p.date].push(p.price);
        }
        const pyeong = m2ToPyeong(area);
        return Object.entries(byMonth)
          .map(([date, arr]) => {
            const avg = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
            return {
              date,
              price: avg,
              pricePerPyeong: Math.round(avg / pyeong),
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      const resultA = aggregateMonthly(pricesA, areaA);
      const resultB = aggregateMonthly(pricesB, areaB);

      res.set("Cache-Control", "public, max-age=86400");
      res.json({
        a: { name: aptA, area: areaA, lawdCd: lawdCdA, prices: resultA },
        b: { name: aptB, area: areaB, lawdCd: lawdCdB, prices: resultB },
      });
    } catch (err) {
      console.error("aptBattle failed:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================
// aptBattleOg - OG 이미지 생성
// ============================================
function buildAptBattleSvg(nameA, nameB, areaA, areaB) {
  const initA = nameA.charAt(0);
  const initB = nameB.charAt(0);
  return `<svg width="600" height="315" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f0fdf4"/>
        <stop offset="100%" stop-color="#ecfdf5"/>
      </linearGradient>
    </defs>
    <rect width="600" height="315" fill="url(#bg)" rx="0"/>
    <rect x="20" y="14" width="100" height="28" rx="14" fill="#059669"/>
    <text x="70" y="33" font-size="13" font-weight="700" fill="white" text-anchor="middle" font-family="sans-serif">아파트 배틀</text>
    <rect x="40" y="65" width="220" height="180" rx="20" fill="white" stroke="#d1d5db" stroke-width="1"/>
    <circle cx="150" cy="125" r="36" fill="#059669"/>
    <text x="150" y="140" font-size="28" fill="white" text-anchor="middle" font-weight="700" font-family="sans-serif">${initA}</text>
    <text x="150" y="175" font-size="15" fill="#111827" text-anchor="middle" font-weight="700" font-family="sans-serif">${nameA.length > 10 ? nameA.slice(0, 10) + ".." : nameA}</text>
    <text x="150" y="195" font-size="11" fill="#6b7280" text-anchor="middle" font-family="sans-serif">${areaA}m²</text>
    <rect x="340" y="65" width="220" height="180" rx="20" fill="white" stroke="#d1d5db" stroke-width="1"/>
    <circle cx="450" cy="125" r="36" fill="#7c3aed"/>
    <text x="450" y="140" font-size="28" fill="white" text-anchor="middle" font-weight="700" font-family="sans-serif">${initB}</text>
    <text x="450" y="175" font-size="15" fill="#111827" text-anchor="middle" font-weight="700" font-family="sans-serif">${nameB.length > 10 ? nameB.slice(0, 10) + ".." : nameB}</text>
    <text x="450" y="195" font-size="11" fill="#6b7280" text-anchor="middle" font-family="sans-serif">${areaB}m²</text>
    <circle cx="300" cy="145" r="26" fill="#111827"/>
    <text x="300" y="152" font-size="16" fill="white" text-anchor="middle" font-weight="900" font-family="sans-serif">VS</text>
    <text x="300" y="275" font-size="14" fill="#374151" text-anchor="middle" font-weight="600" font-family="sans-serif">어디가 더 올랐을까? 🏠</text>
    <text x="300" y="302" font-size="11" fill="#9ca3af" text-anchor="middle" font-family="sans-serif">SUILE 아파트 배틀</text>
  </svg>`;
}

exports.aptBattleOg = onRequest(
  { region: "asia-northeast3", memory: "256MiB", maxInstances: 10 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");

    const nameA = String(req.query.a || "A");
    const nameB = String(req.query.b || "B");
    const areaA = String(req.query.aa || "84");
    const areaB = String(req.query.ab || "84");

    try {
      const svg = buildAptBattleSvg(nameA, nameB, areaA, areaB);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();

      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(png);
    } catch (err) {
      console.error("aptBattleOg failed:", err);
      res.status(500).send("OG image generation failed");
    }
  }
);

// ============================================
// aptBattleView - 동적 OG HTML
// /ab?a=래미안&la=11680&aa=84&b=자이&lb=11650&ab=84
// ============================================
exports.aptBattleView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 10 },
  async (req, res) => {
    const a = String(req.query.a || "");
    const b = String(req.query.b || "");
    const la = String(req.query.la || "");
    const lb = String(req.query.lb || "");
    const aa = String(req.query.aa || "84");
    const ab = String(req.query.ab || "84");

    const title = `${a} vs ${b} - 어디가 더 올랐을까?`;
    const description = `${a}(${aa}m²) vs ${b}(${ab}m²) 실거래가 배틀! 평당가 상승률 대결 결과를 확인하세요 🏠`;
    const ogImageUrl = `${SITE_URL}/aptBattleOg?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&aa=${aa}&ab=${ab}`;
    const redirectUrl = `${SITE_URL}/tools/apt-battle?a=${encodeURIComponent(a)}&la=${la}&aa=${aa}&b=${encodeURIComponent(b)}&lb=${lb}&ab=${ab}`;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:image" content="${ogImageUrl}"/>
<meta property="og:image:width" content="600"/>
<meta property="og:image:height" content="315"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${description}"/>
<meta name="twitter:image" content="${ogImageUrl}"/>
<meta http-equiv="refresh" content="0;url=${redirectUrl}"/>
</head><body><p>Redirecting...</p><script>location.href="${redirectUrl}";</script></body></html>`;

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(html);
  }
);
