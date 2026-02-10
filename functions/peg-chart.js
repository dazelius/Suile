/**
 * PEG 시계열 차트 Cloud Function
 *
 * 전략 (가능한 한 많이 데이터를 제공):
 *   A. fundamentalsTimeSeries → 분기별 dilutedEPS (최대 5년)
 *   B. 연간 incomeStatementHistory → 연간 EPS → 분기별 PEG 보간
 *   C. defaultKeyStatistics.pegRatio → forward PEG로 최근 분기 보충
 *   D. PE-only fallback → PEG 계산 불가해도 PE 데이터는 제공
 */

const { onRequest } = require("firebase-functions/v2/https");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();

const TICKER_NAMES = {
  AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Google", AMZN: "Amazon",
  NVDA: "NVIDIA", TSLA: "Tesla", META: "Meta", NFLX: "Netflix",
  AMD: "AMD", INTC: "Intel", AVGO: "Broadcom", CRM: "Salesforce",
  ORCL: "Oracle", ADBE: "Adobe", CSCO: "Cisco", QCOM: "Qualcomm",
  MU: "Micron", PLTR: "Palantir", ARM: "ARM Holdings",
  TSM: "TSMC", ASML: "ASML", BABA: "Alibaba",
  V: "Visa", MA: "Mastercard", JPM: "JPMorgan",
  DIS: "Disney", PYPL: "PayPal", BA: "Boeing",
  SERV: "Serve Robotics", RR: "Richtech Robotics",
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF",
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스",
  "035420.KS": "NAVER", "035720.KS": "카카오",
};

function getName(ticker) {
  return TICKER_NAMES[ticker] || ticker;
}

function findClosestPrice(prices, targetDate) {
  const target = new Date(targetDate).getTime();
  let closest = null;
  let minDiff = Infinity;
  for (const p of prices) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < minDiff) { minDiff = diff; closest = p; }
  }
  if (minDiff > 30 * 24 * 60 * 60 * 1000) return null;
  return closest;
}

function toQuarterKey(d) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${y}Q${m <= 2 ? 1 : m <= 5 ? 2 : m <= 8 ? 3 : 4}`;
}

function quarterDate(qKey) {
  const year = parseInt(qKey.slice(0, 4));
  const qNum = parseInt(qKey.slice(5));
  return `${year}-${qNum === 1 ? "03-31" : qNum === 2 ? "06-30" : qNum === 3 ? "09-30" : "12-31"}`;
}

/** PEG 값 정규화: 유효 범위로 클램프 */
function clampPeg(peg) {
  if (peg == null || !isFinite(peg)) return null;
  if (peg < -5) return -5;
  if (peg > 10) return 10;
  return Math.round(peg * 100) / 100;
}

// ============================================
async function calcPegForTicker(ticker) {
  const name = getName(ticker);
  const lookbackYears = 6;
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - lookbackYears);
  const from = fromDate.toISOString().split("T")[0];
  const to = new Date().toISOString().split("T")[0];

  // ── 병렬 데이터 fetch ──
  const [summaryResult, ftsResult, pricesResult] = await Promise.allSettled([
    yahooFinance.quoteSummary(ticker, {
      modules: [
        "defaultKeyStatistics",
        "earningsHistory",
        "earnings",
        "incomeStatementHistory",
        "incomeStatementHistoryQuarterly",
        "financialData",
      ],
    }),
    yahooFinance.fundamentalsTimeSeries(ticker, {
      period1: from,
      period2: to,
      type: "quarterly",
    }).catch((e) => { console.warn(`fts fail ${ticker}:`, e.message); return null; }),
    yahooFinance.historical(ticker, {
      period1: from,
      period2: to,
      interval: "1wk",
    }),
  ]);

  if (pricesResult.status !== "fulfilled" || !pricesResult.value?.length) {
    console.warn(`No price data for ${ticker}`);
    return { name, data: [] };
  }
  const prices = pricesResult.value.map((d) => ({
    date: d.date.toISOString().split("T")[0],
    close: d.close,
  }));

  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const ftsData = ftsResult.status === "fulfilled" ? ftsResult.value : null;

  // ── 분기별 EPS 수집 ──
  const epsMap = new Map();

  // (1) fundamentalsTimeSeries
  if (ftsData && Array.isArray(ftsData)) {
    for (const item of ftsData) {
      try {
        const dateVal = item.date || item.endDate || item.asOfDate;
        if (!dateVal) continue;
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) continue;
        const eps = item.dilutedEPS ?? item.quarterlyDilutedEPS ?? item.basicEPS ?? item.quarterlyBasicEPS ?? null;
        if (eps != null && isFinite(eps)) epsMap.set(toQuarterKey(d), eps);
      } catch { /* skip */ }
    }
  }

  // (2) earningsHistory
  if (summary?.earningsHistory?.history) {
    for (const h of summary.earningsHistory.history) {
      try {
        if (h.epsActual != null && h.quarter) {
          const key = toQuarterKey(new Date(h.quarter));
          if (!epsMap.has(key)) epsMap.set(key, h.epsActual);
        }
      } catch { /* skip */ }
    }
  }

  // (3) earnings.earningsChart.quarterly
  if (summary?.earnings?.earningsChart?.quarterly) {
    for (const q of summary.earnings.earningsChart.quarterly) {
      try {
        if (q.actual != null && q.date) {
          const match = String(q.date).match(/(\d)Q(\d{4})/);
          if (match) {
            const key = `${match[2]}Q${match[1]}`;
            if (!epsMap.has(key)) epsMap.set(key, q.actual);
          }
        }
      } catch { /* skip */ }
    }
  }

  // (4) incomeStatementHistoryQuarterly → netIncome 기반
  const sharesOut = summary?.defaultKeyStatistics?.sharesOutstanding || null;
  if (summary?.incomeStatementHistoryQuarterly?.incomeStatementHistory && sharesOut) {
    for (const stmt of summary.incomeStatementHistoryQuarterly.incomeStatementHistory) {
      try {
        if (stmt.endDate && stmt.netIncome != null) {
          const key = toQuarterKey(new Date(stmt.endDate));
          if (!epsMap.has(key)) {
            const eps = stmt.netIncome / sharesOut;
            if (isFinite(eps)) epsMap.set(key, eps);
          }
        }
      } catch { /* skip */ }
    }
  }

  console.log(`${ticker}: ${epsMap.size} quarterly EPS points`);

  // ── 연간 EPS 수집 ──
  const annualEpsArr = [];
  if (summary?.incomeStatementHistory?.incomeStatementHistory) {
    for (const stmt of summary.incomeStatementHistory.incomeStatementHistory) {
      try {
        if (stmt.endDate && stmt.netIncome != null) {
          const d = new Date(stmt.endDate);
          let eps = null;
          if (typeof stmt.dilutedEPS === "number") eps = stmt.dilutedEPS;
          else if (sharesOut && sharesOut > 0) eps = stmt.netIncome / sharesOut;
          if (eps != null && isFinite(eps)) {
            annualEpsArr.push({ year: d.getFullYear(), eps, date: d.toISOString().split("T")[0] });
          }
        }
      } catch { /* skip */ }
    }
  }
  // 분기 합산으로 연간 EPS 보충
  if (epsMap.size >= 4) {
    const yearEps = {};
    for (const [key, eps] of epsMap.entries()) {
      const year = parseInt(key.slice(0, 4));
      if (!yearEps[year]) yearEps[year] = { total: 0, count: 0 };
      yearEps[year].total += eps;
      yearEps[year].count++;
    }
    for (const [year, data] of Object.entries(yearEps)) {
      if (data.count >= 3 && !annualEpsArr.find((a) => a.year === parseInt(year))) {
        annualEpsArr.push({
          year: parseInt(year),
          eps: data.count === 4 ? data.total : (data.total / data.count) * 4,
          date: `${year}-12-31`,
        });
      }
    }
  }
  annualEpsArr.sort((a, b) => a.year - b.year);

  // ── Yahoo 기본 통계 ──
  const yahooForwardPeg = summary?.defaultKeyStatistics?.pegRatio || null;
  const yahooTrailingPE = summary?.defaultKeyStatistics?.trailingPE || null;
  const yahooForwardPE = summary?.defaultKeyStatistics?.forwardPE || null;
  const yahooTrailingEps = summary?.defaultKeyStatistics?.trailingEps || null;
  const earningsGrowth = summary?.financialData?.earningsGrowth; // 0~1 비율

  console.log(`${ticker}: ${annualEpsArr.length} annual EPS, yahoo PEG=${yahooForwardPeg}, trPE=${yahooTrailingPE}, fwdPE=${yahooForwardPE}`);

  // ==============================
  // PEG 계산 (모든 전략 통합)
  // ==============================
  const dataMap = new Map(); // qKey → data point (중복 방지)

  // ── 전략 A: 분기별 EPS → trailing PEG ──
  if (epsMap.size >= 8) {
    const sortedKeys = Array.from(epsMap.keys()).sort();
    for (let i = 7; i < sortedKeys.length; i++) {
      const qKey = sortedKeys[i];
      const dateStr = quarterDate(qKey);
      if (new Date(dateStr) > new Date()) continue;
      const pricePoint = findClosestPrice(prices, dateStr);
      if (!pricePoint) continue;

      let trailing4Q = 0, cnt = 0;
      for (let j = i; j >= i - 3 && j >= 0; j--) { trailing4Q += epsMap.get(sortedKeys[j]) || 0; cnt++; }
      if (cnt < 4) continue;

      let trailing4QPrev = 0, cntPrev = 0;
      for (let j = i - 4; j >= i - 7 && j >= 0; j--) { trailing4QPrev += epsMap.get(sortedKeys[j]) || 0; cntPrev++; }
      if (cntPrev < 4) continue;

      const epsGrowth = Math.abs(trailing4QPrev) > 0.001
        ? ((trailing4Q - trailing4QPrev) / Math.abs(trailing4QPrev)) * 100
        : null;

      // PE 계산 (적자여도 절대값 PE 계산)
      const pe = trailing4Q !== 0 ? pricePoint.close / trailing4Q : null;

      // PEG 계산 (양의 성장률 + 양의 PE일 때만 정상 PEG)
      let peg = null;
      if (epsGrowth != null && epsGrowth > 0 && pe != null && pe > 0) {
        peg = clampPeg(pe / epsGrowth);
      }

      dataMap.set(qKey, {
        quarter: qKey,
        date: dateStr,
        peg,
        pe: pe != null ? Math.round(pe * 100) / 100 : null,
        epsGrowth: epsGrowth != null ? Math.round(epsGrowth * 10) / 10 : null,
      });
    }
  }
  console.log(`${ticker}: Strategy A → ${dataMap.size} points`);

  // ── 전략 B: 연간 EPS → 분기별 PEG ──
  if (dataMap.size === 0 && annualEpsArr.length >= 2) {
    for (let i = 1; i < annualEpsArr.length; i++) {
      const curr = annualEpsArr[i];
      const prev = annualEpsArr[i - 1];

      const epsGrowth = Math.abs(prev.eps) > 0.001
        ? ((curr.eps - prev.eps) / Math.abs(prev.eps)) * 100
        : null;

      const quarters = [
        { q: "Q1", date: `${curr.year}-03-31` },
        { q: "Q2", date: `${curr.year}-06-30` },
        { q: "Q3", date: `${curr.year}-09-30` },
        { q: "Q4", date: `${curr.year}-12-31` },
      ];

      for (const qd of quarters) {
        if (new Date(qd.date) > new Date()) break;
        const pricePoint = findClosestPrice(prices, qd.date);
        if (!pricePoint) continue;

        const pe = curr.eps !== 0 ? pricePoint.close / curr.eps : null;
        let peg = null;
        if (epsGrowth != null && epsGrowth > 0 && pe != null && pe > 0) {
          peg = clampPeg(pe / epsGrowth);
        }

        const qKey = `${curr.year}${qd.q}`;
        if (!dataMap.has(qKey)) {
          dataMap.set(qKey, {
            quarter: qKey,
            date: qd.date,
            peg,
            pe: pe != null ? Math.round(pe * 100) / 100 : null,
            epsGrowth: epsGrowth != null ? Math.round(epsGrowth * 10) / 10 : null,
          });
        }
      }
    }
    console.log(`${ticker}: Strategy B → ${dataMap.size} points`);
  }

  // ── 전략 C: Yahoo forward PEG로 최근 분기 보충 ──
  if (yahooForwardPeg && isFinite(yahooForwardPeg) && yahooForwardPeg > 0) {
    const now = new Date();
    // 최근 4분기에 forward PEG 적용 (기존 데이터 없는 분기만)
    for (let offset = 0; offset < 4; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset * 3, 1);
      const qKey = toQuarterKey(d);
      const dateStr = quarterDate(qKey);
      if (new Date(dateStr) > now) continue;

      if (!dataMap.has(qKey) || dataMap.get(qKey).peg == null) {
        const pricePoint = findClosestPrice(prices, dateStr);
        const existingPe = dataMap.has(qKey) ? dataMap.get(qKey).pe : null;
        const pe = existingPe || (pricePoint && yahooTrailingEps && yahooTrailingEps !== 0
          ? Math.round((pricePoint.close / yahooTrailingEps) * 100) / 100
          : yahooTrailingPE ? Math.round(yahooTrailingPE * 100) / 100 : null);

        dataMap.set(qKey, {
          quarter: qKey,
          date: dateStr,
          peg: Math.round(yahooForwardPeg * 100) / 100,
          pe,
          epsGrowth: earningsGrowth ? Math.round(earningsGrowth * 1000) / 10 : null,
          forward: true, // forward PEG 사용 표시
        });
      }
    }
    console.log(`${ticker}: Strategy C (forward PEG=${yahooForwardPeg}) → ${dataMap.size} total`);
  }

  // ── 전략 D: PE-only fallback (PEG 전혀 없는 종목) ──
  if (dataMap.size === 0) {
    // 연간 EPS 기반 PE 시계열
    if (annualEpsArr.length >= 1) {
      for (const annual of annualEpsArr) {
        if (annual.eps === 0) continue;
        const quarters = [
          { q: "Q1", date: `${annual.year}-03-31` },
          { q: "Q2", date: `${annual.year}-06-30` },
          { q: "Q3", date: `${annual.year}-09-30` },
          { q: "Q4", date: `${annual.year}-12-31` },
        ];
        for (const qd of quarters) {
          if (new Date(qd.date) > new Date()) break;
          const pricePoint = findClosestPrice(prices, qd.date);
          if (!pricePoint) continue;
          const pe = pricePoint.close / annual.eps;
          const qKey = `${annual.year}${qd.q}`;
          dataMap.set(qKey, {
            quarter: qKey,
            date: qd.date,
            peg: null,
            pe: Math.round(pe * 100) / 100,
            epsGrowth: null,
            peOnly: true,
          });
        }
      }
    }
    // trailing PE로 현재 분기라도 추가
    if (dataMap.size === 0 && (yahooTrailingPE || yahooForwardPE)) {
      const qKey = toQuarterKey(new Date());
      dataMap.set(qKey, {
        quarter: qKey,
        date: quarterDate(qKey),
        peg: null,
        pe: Math.round((yahooTrailingPE || yahooForwardPE) * 100) / 100,
        epsGrowth: earningsGrowth ? Math.round(earningsGrowth * 1000) / 10 : null,
        peOnly: true,
      });
    }
    console.log(`${ticker}: Strategy D (PE-only) → ${dataMap.size} points`);
  }

  // 정렬하여 반환
  const data = Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { name, data };
}

// ============================================
exports.pegHistory = onRequest(
  { region: "asia-northeast3", memory: "512MiB", maxInstances: 10, timeoutSeconds: 120 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const tickersParam = String(req.query.tickers || "").trim();
    if (!tickersParam) {
      res.status(400).json({ error: "Missing parameter: tickers" });
      return;
    }

    const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);
    if (tickers.length === 0) {
      res.status(400).json({ error: "No valid tickers provided" });
      return;
    }

    try {
      const results = {};
      await Promise.all(tickers.map(async (ticker) => {
        try {
          results[ticker] = await calcPegForTicker(ticker);
        } catch (err) {
          console.error(`calcPeg fail ${ticker}:`, err);
          results[ticker] = { name: getName(ticker), data: [] };
        }
      }));

      res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.json({ tickers: results });
    } catch (err) {
      console.error("PEG history failed:", err);
      res.status(500).json({ error: "Failed to calculate PEG history", detail: err.message });
    }
  }
);
