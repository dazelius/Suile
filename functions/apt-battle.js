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
const MOLIT_BASE = "http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

const xmlParser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function getApiKey() {
  return process.env.MOLIT_API_KEY || "";
}

// ── 국토교통부 API 호출 ──
async function fetchMolitData(lawdCd, dealYmd) {
  const apiKey = getApiKey();
  // API 키가 이미 URL 인코딩된 상태 → 그대로 사용
  const url = `${MOLIT_BASE}?serviceKey=${apiKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=9999&pageNo=1`;
  console.log(`[MOLIT] Fetching: lawdCd=${lawdCd}, dealYmd=${dealYmd}`);
  const res = await fetch(url);
  const xml = await res.text();
  console.log(`[MOLIT] Response status: ${res.status}, length: ${xml.length}, preview: ${xml.substring(0, 300)}`);

  const parsed = xmlParser.parse(xml);
  const body = parsed?.response?.body;
  if (!body || !body.items) {
    // 에러 응답 체크
    const header = parsed?.response?.header;
    if (header) {
      console.log(`[MOLIT] API header: resultCode=${header.resultCode}, resultMsg=${header.resultMsg}`);
    }
    return [];
  }

  const items = body.items.item;
  if (!items) return [];
  const result = Array.isArray(items) ? items : [items];
  console.log(`[MOLIT] Got ${result.length} items for lawdCd=${lawdCd}, dealYmd=${dealYmd}`);
  return result;
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
      // 격월 데이터 수집 (1,3,5,7,9,11월) → 거래건별 반환
      const now = new Date();
      const months = [];
      for (let y = 0; y < years; y++) {
        for (const m of [1, 3, 5, 7, 9, 11]) {
          const d = new Date(now.getFullYear() - y, m - 1, 1);
          if (d <= now) {
            months.push(`${d.getFullYear()}${String(m).padStart(2, "0")}`);
          }
        }
      }
      months.sort();

      // 같은 시군구면 한 번만 fetch, 동시 3개씩 병렬 처리
      const cache = {};
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

      // 병렬 fetch (3개씩 배치)
      const allLawdCds = new Set([lawdCdA, lawdCdB]);
      for (let i = 0; i < months.length; i += 3) {
        const batch = months.slice(i, i + 3);
        const tasks = [];
        for (const m of batch) {
          for (const cd of allLawdCds) {
            tasks.push(fetchCached(cd, m));
          }
        }
        await Promise.all(tasks);
      }

      // 개별 거래건 수집
      function collectTxns(lawdCd, aptName, area) {
        const pyeong = m2ToPyeong(area);
        const txns = [];
        for (const m of months) {
          const items = cache[`${lawdCd}_${m}`] || [];
          for (const item of items) {
            const name = String(item["아파트"] || item["aptNm"] || "").trim();
            const itemArea = Math.round(parseFloat(item["전용면적"] || item["excluUseAr"] || 0));
            if (name !== aptName || Math.abs(itemArea - area) > 3) continue;
            const price = parsePrice(item["거래금액"] || item["dealAmount"]);
            if (price <= 0) continue;
            const yr = String(item["년"] || item["dealYear"] || "");
            const mo = String(item["월"] || item["dealMonth"] || "").padStart(2, "0");
            const dy = String(item["일"] || item["dealDay"] || "").padStart(2, "0");
            txns.push({
              date: `${yr}-${mo}-${dy}`,
              price,
              pricePerPyeong: Math.round(price / pyeong),
              floor: String(item["층"] || item["floor"] || "").trim(),
            });
          }
        }
        return txns.sort((a, b) => a.date.localeCompare(b.date));
      }

      const resultA = collectTxns(lawdCdA, aptA, areaA);
      const resultB = collectTxns(lawdCdB, aptB, areaB);

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
// aptBattleView - 동적 OG HTML (정적 이미지 + 동적 텍스트)
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

    const title = `[${a}] vs [${b}] 승자는?`;
    const description = `${a}(${aa}m²) vs ${b}(${ab}m²) 실거래가 평당가 배틀! 어디가 더 올랐을까? 🏠`;
    const ogImageUrl = `${SITE_URL}/apt-battle-og.png`;
    const redirectUrl = `${SITE_URL}/tools/apt-battle?a=${encodeURIComponent(a)}&la=${la}&aa=${aa}&b=${encodeURIComponent(b)}&lb=${lb}&ab=${ab}`;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:image" content="${ogImageUrl}"/>
<meta property="og:image:width" content="1024"/>
<meta property="og:image:height" content="1024"/>
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
