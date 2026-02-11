/**
 * 주식 성적표 Cloud Functions
 *
 * - stockScore     : S&P 500 랭킹 (하루 1회) + 개별 종목 상세 성적표
 * - stockScoreView : 동적 OG HTML
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();

// Firebase Admin 초기화 (중복 방지)
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const { SP500 } = require("./stock-universe");
const SITE_URL = "https://suile-21173.web.app";

// ── 종목 이름 매핑 ──
const NAMES = {
  AAPL:"Apple",MSFT:"Microsoft",GOOGL:"Google",AMZN:"Amazon",NVDA:"NVIDIA",
  META:"Meta",TSLA:"Tesla",BRK_B:"Berkshire",JPM:"JPMorgan",V:"Visa",
  MA:"Mastercard",UNH:"UnitedHealth",JNJ:"J&J",PG:"P&G",HD:"Home Depot",
  AVGO:"Broadcom",ORCL:"Oracle",CRM:"Salesforce",ADBE:"Adobe",NFLX:"Netflix",
  AMD:"AMD",COST:"Costco",PEP:"PepsiCo",KO:"Coca-Cola",LLY:"Eli Lilly",
  ABBV:"AbbVie",MRK:"Merck",TMO:"Thermo Fisher",WMT:"Walmart",BAC:"Bank of America",
  DIS:"Disney",CSCO:"Cisco",ACN:"Accenture",INTC:"Intel",IBM:"IBM",
  QCOM:"Qualcomm",TXN:"Texas Instruments",GE:"GE",CAT:"Caterpillar",
  HON:"Honeywell",BA:"Boeing",GS:"Goldman Sachs",MCD:"McDonald's",
  NKE:"Nike",SBUX:"Starbucks",XOM:"Exxon",CVX:"Chevron",PLTR:"Palantir",
};

function getName(ticker) {
  const clean = ticker.replace("-", "_");
  return NAMES[clean] || NAMES[ticker] || ticker;
}

// ── 채점 유틸 ──
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function scorePE(pe) {
  if (!pe || pe <= 0) return 0;
  if (pe < 10) return 20;
  if (pe < 15) return 17;
  if (pe < 20) return 14;
  if (pe < 25) return 11;
  if (pe < 35) return 7;
  if (pe < 50) return 4;
  return 1;
}

function scorePB(pb) {
  if (!pb || pb <= 0) return 5;
  if (pb < 1) return 20;
  if (pb < 2) return 16;
  if (pb < 3) return 13;
  if (pb < 5) return 10;
  if (pb < 10) return 6;
  return 2;
}

/**
 * PEG 점수 (0-20)
 * PEG = PE / EPS성장률. 1 이하면 저평가, 2 이상이면 고평가.
 * PE가 높아도 성장이 뒷받침되면 합리적 가격으로 평가.
 */
function scorePEG(q) {
  const peg = q.pegRatio;
  if (!peg || peg <= 0) {
    // PEG 데이터 없으면 → Forward PE / EPS 성장으로 직접 추정
    const fpe = q.forwardPE || q.trailingPE;
    const epsFwd = q.epsForward || 0;
    const epsTTM = q.epsTrailingTwelveMonths || 0;
    if (!fpe || !epsTTM || epsTTM <= 0 || !epsFwd) return 10; // 데이터 부족 → 중립
    const growth = ((epsFwd - epsTTM) / Math.abs(epsTTM)) * 100;
    if (growth <= 0) return 5; // 역성장 → 낮게
    const estimated = fpe / growth;
    return scorePEGValue(estimated);
  }
  return scorePEGValue(peg);
}

function scorePEGValue(peg) {
  if (peg < 0.5) return 20;  // 심한 저평가
  if (peg < 1.0) return 18;  // 저평가 (성장 대비 싸다)
  if (peg < 1.5) return 14;  // 적정~약간 저평가
  if (peg < 2.0) return 10;  // 적정
  if (peg < 3.0) return 6;   // 약간 고평가
  if (peg < 5.0) return 3;   // 고평가
  return 1;                   // 심한 고평가
}

/** PEG 실제 값 추출 (없으면 자체 추정, 추정도 불가면 null) */
function getPEGValue(q) {
  if (q.pegRatio && q.pegRatio > 0) return q.pegRatio;
  // Forward PE / EPS 성장률로 추정
  const fpe = q.forwardPE || q.trailingPE;
  const epsFwd = q.epsForward || 0;
  const epsTTM = q.epsTrailingTwelveMonths || 0;
  if (!fpe || !epsTTM || epsTTM <= 0 || !epsFwd) return null;
  const growth = ((epsFwd - epsTTM) / Math.abs(epsTTM)) * 100;
  if (growth <= 0) return null; // 역성장은 PEG 의미 없음
  return Math.round((fpe / growth) * 100) / 100;
}

function scoreEPSGrowth(epsForward, epsTTM) {
  if (!epsForward || !epsTTM || epsTTM <= 0) return 5;
  const growth = (epsForward - epsTTM) / Math.abs(epsTTM);
  if (growth > 0.3) return 20;
  if (growth > 0.2) return 17;
  if (growth > 0.1) return 14;
  if (growth > 0.05) return 11;
  if (growth > 0) return 8;
  if (growth > -0.1) return 4;
  return 1;
}

function score52w(pct) {
  if (pct == null) return 5;
  const p = pct * 100; // decimal → %
  if (p > 50) return 20;
  if (p > 30) return 17;
  if (p > 15) return 14;
  if (p > 5) return 11;
  if (p > 0) return 8;
  if (p > -15) return 4;
  return 1;
}

/**
 * 주주환원 점수 (0-20)
 * - 배당 기업: 배당수익률 기반 채점
 * - 무배당 기업: 성장 재투자 기업으로 간주하여 성장성 기반 보정
 *   (Netflix 같은 고성장 무배당 기업이 F등급을 받는 불공정 방지)
 */
function scoreDividend(yld, q) {
  const pct = (yld || 0) * 100;
  if (pct > 5) return 20;
  if (pct > 3) return 17;
  if (pct > 2) return 14;
  if (pct > 1) return 10;
  if (pct > 0.5) return 6;
  if (pct > 0) return 3;

  // 무배당 기업 → 성장 재투자 프리미엄 적용
  // 고성장 + 고수익이면 배당 대신 재투자하는 전략적 선택으로 간주
  if (!q) return 6; // 정보 없으면 중립
  const epsGrowth = q.epsForward && q.epsTrailingTwelveMonths && q.epsTrailingTwelveMonths > 0
    ? (q.epsForward - q.epsTrailingTwelveMonths) / q.epsTrailingTwelveMonths
    : 0;
  const revGrowth = q.revenueGrowth || 0;
  const margin = q.profitMargins || 0;

  // 고성장(EPS↑ or 매출↑) + 흑자 → 재투자 전략으로 높게 평가
  let reinvestScore = 6; // 기본 중립 (C등급 수준)
  if (epsGrowth > 0.15 || revGrowth > 0.15) reinvestScore += 4; // 고성장
  else if (epsGrowth > 0.05 || revGrowth > 0.05) reinvestScore += 2; // 성장
  if (margin > 0.15) reinvestScore += 4; // 고수익성
  else if (margin > 0.05) reinvestScore += 2; // 수익성

  return Math.min(reinvestScore, 18); // 최대 18 (배당 5%+ 기업보다는 약간 낮게)
}

function scoreMarketCap(mc) {
  if (!mc) return 5;
  if (mc > 500e9) return 20;
  if (mc > 100e9) return 16;
  if (mc > 50e9) return 13;
  if (mc > 10e9) return 10;
  return 5;
}

// ── 수익성 채점 (개선) ──
function scoreProfit(q) {
  let pts = 0;
  const price = q.regularMarketPrice || 1;
  const epsTTM = q.epsTrailingTwelveMonths || 0;
  const epsFwd = q.epsForward || 0;
  const pe = q.trailingPE || 0;
  const fwdPE = q.forwardPE || 0;

  // 1) Earnings Yield (EPS/Price) — 높을수록 수익성 좋음 (0-10점)
  if (epsTTM > 0) {
    const ey = (epsTTM / price) * 100; // %
    if (ey > 8) pts += 10;
    else if (ey > 5) pts += 8;
    else if (ey > 3) pts += 6;
    else if (ey > 1) pts += 4;
    else pts += 2;
  }

  // 2) Forward PE 개선도 — Forward가 낮으면 이익 개선 중 (0-10점)
  if (fwdPE > 0 && pe > 0) {
    const improvement = (pe - fwdPE) / pe;
    if (improvement > 0.2) pts += 10;
    else if (improvement > 0.1) pts += 8;
    else if (improvement > 0.05) pts += 6;
    else if (improvement > 0) pts += 4;
    else if (improvement > -0.1) pts += 2;
    else pts += 1;
  } else if (epsFwd > 0 && epsTTM > 0 && epsFwd > epsTTM) {
    pts += 5; // Forward EPS가 현재보다 높으면 기본점
  } else {
    pts += 3;
  }

  return clamp(pts, 0, 20);
}

// ── 안정성 채점 (개선: 시총 + 베타 + 52주 위치) ──
function scoreHealth(q) {
  let pts = 0;
  const mc = q.marketCap || 0;
  const price = q.regularMarketPrice || 0;
  const w52high = q.fiftyTwoWeekHigh || 0;
  const w52low = q.fiftyTwoWeekLow || 0;

  // 1) 시가총액 (0-8점)
  if (mc > 500e9) pts += 8;
  else if (mc > 100e9) pts += 7;
  else if (mc > 50e9) pts += 6;
  else if (mc > 10e9) pts += 5;
  else pts += 3;

  // 2) 52주 범위 내 위치 — 고점 가까울수록 안정 (0-7점)
  if (w52high > 0 && w52low > 0 && w52high > w52low) {
    const range = w52high - w52low;
    const pos = (price - w52low) / range; // 0=저점, 1=고점
    if (pos > 0.8) pts += 7;
    else if (pos > 0.6) pts += 5;
    else if (pos > 0.4) pts += 3;
    else if (pos > 0.2) pts += 2;
    else pts += 1;
  } else {
    pts += 3;
  }

  // 3) 변동성 — 52주 범위 대비 가격 (0-5점, 범위 좁을수록 안정)
  if (w52high > 0 && price > 0) {
    const volatility = (w52high - w52low) / price;
    if (volatility < 0.3) pts += 5;
    else if (volatility < 0.5) pts += 4;
    else if (volatility < 0.7) pts += 3;
    else if (volatility < 1.0) pts += 2;
    else pts += 1;
  } else {
    pts += 2;
  }

  return clamp(pts, 0, 20);
}

// ── 과매도 감지 ──
function detectOversold(q) {
  const price = q.regularMarketPrice || 0;
  const w52high = q.fiftyTwoWeekHigh || 0;
  const ma50 = q.fiftyDayAverage || 0;
  const ma200 = q.twoHundredDayAverage || 0;

  const dropFromHigh = w52high > 0 ? ((price - w52high) / w52high) : 0;
  const belowMA50 = ma50 > 0 && price < ma50;
  const belowMA200 = ma200 > 0 && price < ma200;

  // 과매도 판정: 고점 대비 -25% 이상 하락, 또는 이평선 모두 아래 + 15% 하락
  const isOversold = dropFromHigh < -0.25 || (belowMA50 && belowMA200 && dropFromHigh < -0.15);

  return {
    dropFromHigh: Math.round(dropFromHigh * 1000) / 10, // % (소수 1자리)
    belowMA50,
    belowMA200,
    ma50: ma50 || null,
    ma200: ma200 || null,
    isOversold,
  };
}

// ── 저점매수 점수 (bargainScore, 100점 만점) ──
function computeBargainScore(q) {
  const price = q.regularMarketPrice || 0;
  const w52high = q.fiftyTwoWeekHigh || 0;
  const w52low = q.fiftyTwoWeekLow || 0;
  const ma50 = q.fiftyDayAverage || 0;
  const ma200 = q.twoHundredDayAverage || 0;
  const vol = q.regularMarketVolume || 0;
  const avgVol = q.averageDailyVolume3Month || 0;
  const epsTTM = q.epsTrailingTwelveMonths || 0;
  const epsFwd = q.epsForward || 0;
  const mc = q.marketCap || 0;
  const fwdPE = q.forwardPE || 0;

  let pts = 0;

  // 1) 52주 고점 대비 하락폭 (0~25pt)
  //    크게 떨어질수록 과매도 가능성 ↑
  if (w52high > 0 && price > 0) {
    const drop = ((price - w52high) / w52high) * 100; // 음수 %
    if (drop <= -40) pts += 25;
    else if (drop <= -30) pts += 22;
    else if (drop <= -25) pts += 19;
    else if (drop <= -20) pts += 16;
    else if (drop <= -15) pts += 12;
    else if (drop <= -10) pts += 8;
    else if (drop <= -5) pts += 4;
    else pts += 0;
  }

  // 2) 이평선 이탈 (0~25pt)
  //    50일·200일 이평선 아래 = 하락 추세 → 역발상 매수 기회
  if (ma50 > 0 && price > 0) {
    const gap50 = ((price - ma50) / ma50) * 100;
    if (gap50 < -15) pts += 13;
    else if (gap50 < -10) pts += 10;
    else if (gap50 < -5) pts += 7;
    else if (gap50 < 0) pts += 4;
    else pts += 0;
  }
  if (ma200 > 0 && price > 0) {
    const gap200 = ((price - ma200) / ma200) * 100;
    if (gap200 < -20) pts += 12;
    else if (gap200 < -10) pts += 9;
    else if (gap200 < -5) pts += 6;
    else if (gap200 < 0) pts += 3;
    else pts += 0;
  }

  // 3) 거래량 이상 (0~15pt)
  //    평소 대비 거래 폭증 = 투매/캐피처레이션 가능
  const volumeRatio = avgVol > 0 ? vol / avgVol : 1;
  if (volumeRatio > 3) pts += 15;
  else if (volumeRatio > 2.5) pts += 12;
  else if (volumeRatio > 2) pts += 10;
  else if (volumeRatio > 1.5) pts += 6;
  else if (volumeRatio > 1.2) pts += 3;
  else pts += 0;

  // 4) 52주 저점 근접도 (0~20pt)
  //    저점에 가까울수록 더 과매도
  if (w52high > 0 && w52low > 0 && w52high > w52low && price > 0) {
    const range = w52high - w52low;
    const pos = (price - w52low) / range; // 0=저점, 1=고점
    if (pos < 0.05) pts += 20;
    else if (pos < 0.10) pts += 17;
    else if (pos < 0.20) pts += 14;
    else if (pos < 0.30) pts += 11;
    else if (pos < 0.40) pts += 8;
    else if (pos < 0.50) pts += 5;
    else pts += 0;
  }

  // 5) 기본기 필터 (0~15pt)
  //    "떨어졌지만 기본기 탄탄한 기업"에만 높은 점수
  if (epsTTM > 0) pts += 5;       // EPS 양수 → 흑자 기업
  if (epsFwd > 0) pts += 3;       // Forward EPS 양수 → 미래 이익 전망 긍정
  if (mc > 100e9) pts += 4;       // 시총 1000억$ 이상 대형주
  else if (mc > 10e9) pts += 2;   // 시총 100억$ 이상
  if (fwdPE > 0 && fwdPE < 30) pts += 3; // 합리적 Forward PE

  return {
    bargainScore: clamp(pts, 0, 100),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    near52Low: w52high > w52low && w52high > 0
      ? Math.round(((price - w52low) / (w52high - w52low)) * 100)
      : 50,
  };
}

// ════════════════════════════════════════════════
// SUILE 투자 매력도 - 채점 철학
// ════════════════════════════════════════════════
//
// Q1. 이 기업은 돈을 잘 버는가? → 수익력 30점 (가장 핵심)
//     - Earnings Yield: 주가 대비 실제 벌어들이는 이익률
//     - Forward PE 개선도: 이익이 나아지고 있는가
//     근거: 모든 투자의 출발점. 이익을 못 내는 기업은 아무리 싸도 의미 없음.
//
// Q2. 앞으로 더 잘 벌 것인가? → 성장력 25점
//     - EPS Forward vs TTM: 애널리스트 컨센서스 기반 이익 성장률
//     - 52주 수익률: 시장이 이미 인정한 모멘텀
//     근거: 과거보다 미래. 성장하는 기업이 장기적으로 가장 높은 수익을 줌.
//
// Q3. 지금 사면 비싼가 싼가? → 가격매력 20점
//     - PER: 이익 대비 주가 수준
//     - PBR: 자산 대비 주가 수준
//     - PEG: PE ÷ 성장률 — 성장 대비 주가가 합리적인지
//     근거: 좋은 기업이라도 비싸면 수익이 제한됨. PEG로 성장주의 합리적 가격도 평가.
//
// Q4. 위기에 견딜 수 있는가? → 체력 15점
//     - 시가총액: 대형주일수록 파산 리스크 낮음
//     - 52주 범위 위치: 고점 근처 = 시장 신뢰 확인
//     - 변동성: 범위가 좁을수록 안정적
//     근거: 불확실한 시장에서 살아남는 것이 수익의 전제조건.
//
// Q5. 주주에게 환원하는가? → 주주환원 10점
//     - 배당 기업: 배당수익률 기반 채점
//     - 무배당 기업: 성장 재투자 전략으로 간주 → 성장률+수익성 기반 보정
//     근거: Netflix 같은 고성장 무배당 기업이 F등급 받는 불공정 방지.
//           배당 대신 재투자로 주주가치를 올리는 것도 훌륭한 주주환원.
//
// 총 100점. 수익력 > 성장력 > 가격매력 > 체력 > 주주환원 순으로 가중.
// ════════════════════════════════════════════════
function computeScore(q) {
  const pe = q.trailingPE || q.forwardPE || 0;
  const pb = q.priceToBook || 0;
  const epsFwd = q.epsForward || 0;
  const epsTTM = q.epsTrailingTwelveMonths || 0;
  const w52 = q.fiftyTwoWeekChangePercent || 0;
  const divYield = q.trailingAnnualDividendYield || q.dividendYield || 0;

  // 원시 점수 (각 0-20 스케일로 평가 후 가중치 반영)
  const profitRaw = scoreProfit(q);                                  // 수익력
  const growthRaw = (scoreEPSGrowth(epsFwd, epsTTM) + score52w(w52)) / 2; // 성장력
  // 가격매력: PEG에 가중치를 더 부여 (PEG는 PE+성장률 종합 지표이므로)
  // PEG 50%, PE 30%, PB 20%
  const pegScore = scorePEG(q);
  const peScore = scorePE(pe);
  const pbScore = scorePB(pb);
  const valueRaw = pegScore * 0.5 + peScore * 0.3 + pbScore * 0.2;  // 가격매력
  const healthRaw = scoreHealth(q);                                  // 체력
  const dividendRaw = scoreDividend(divYield, q);                    // 주주환원

  // 가중치 스케일링: raw(0-20) → 목표 배점
  const profit = Math.round(clamp(profitRaw / 20 * 30, 0, 30));     // 수익력 /30
  const growth = Math.round(clamp(growthRaw / 20 * 25, 0, 25));     // 성장력 /25
  const value = Math.round(clamp(valueRaw / 20 * 20, 0, 20));       // 가격매력 /20
  const health = Math.round(clamp(healthRaw / 20 * 15, 0, 15));     // 체력 /15
  const dividend = Math.round(clamp(dividendRaw / 20 * 10, 0, 10)); // 주주환원 /10

  const total = profit + growth + value + health + dividend;
  const oversold = detectOversold(q);

  return { profit, growth, value, health, dividend, total, oversold };
}

function getGrade(score) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

// 비율 기반 카테고리 등급 (만점이 카테고리마다 다르므로)
function getCategoryGrade(score, maxScore) {
  const pct = score / maxScore;
  if (pct >= 0.9) return "S";
  if (pct >= 0.75) return "A";
  if (pct >= 0.6) return "B";
  if (pct >= 0.45) return "C";
  if (pct >= 0.3) return "D";
  return "F";
}

// ── 배치 quote 호출 ──
async function batchQuote(tickers, batchSize = 30) {
  const results = [];
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    try {
      // yahoo-finance2 v3: quote는 단일 또는 배열 지원
      const data = await Promise.all(
        batch.map(async (t) => {
          try {
            return await yahooFinance.quote(t);
          } catch { return null; }
        })
      );
      results.push(...data.filter(Boolean));
    } catch (err) {
      console.error(`Batch ${i} failed:`, err.message);
    }
    // rate limit 배려
    if (i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return results;
}

// ── 오늘 날짜 (KST) ──
function todayKST() {
  const d = new Date();
  d.setHours(d.getHours() + 9);
  return d.toISOString().split("T")[0];
}

// ============================================
// stockScore - 랭킹 + 개별 상세
// ============================================
exports.stockScore = onRequest(
  { region: "asia-northeast3", memory: "1GiB", maxInstances: 5, timeoutSeconds: 300 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const mode = String(req.query.mode || "").trim();
    const ticker = String(req.query.ticker || "").trim().toUpperCase();

    try {
      // ── 개별 종목 상세 ──
      if (ticker) {
        const q = await yahooFinance.quote(ticker);
        if (!q || !q.symbol) {
          res.status(404).json({ error: "종목을 찾을 수 없습니다" });
          return;
        }

        let detail = {};
        try {
          const summary = await yahooFinance.quoteSummary(ticker, {
            modules: [
              "defaultKeyStatistics", "financialData", "summaryDetail",
              "incomeStatementHistory", "earningsHistory", "earnings",
              "incomeStatementHistoryQuarterly", "calendarEvents",
            ],
          });
          const ks = summary.defaultKeyStatistics || {};
          const fd = summary.financialData || {};
          const sd = summary.summaryDetail || {};

          // ── 정확한 Trailing PEG 계산 (peg-chart와 동일 방식) ──
          let computedPeg = null;
          let pegPE = null;
          let pegEpsGrowth = null;
          try {
            // 분기별 EPS 수집
            const qEpsMap = new Map();

            // earningsHistory
            if (summary.earningsHistory?.history) {
              for (const h of summary.earningsHistory.history) {
                if (h.epsActual != null && h.quarter) {
                  const d = new Date(h.quarter);
                  const y = d.getFullYear();
                  const m = d.getMonth();
                  const key = `${y}Q${m <= 2 ? 1 : m <= 5 ? 2 : m <= 8 ? 3 : 4}`;
                  qEpsMap.set(key, h.epsActual);
                }
              }
            }
            // earnings.earningsChart.quarterly
            if (summary.earnings?.earningsChart?.quarterly) {
              for (const eq of summary.earnings.earningsChart.quarterly) {
                if (eq.actual != null && eq.date) {
                  const match = String(eq.date).match(/(\d)Q(\d{4})/);
                  if (match) {
                    const key = `${match[2]}Q${match[1]}`;
                    if (!qEpsMap.has(key)) qEpsMap.set(key, eq.actual);
                  }
                }
              }
            }
            // incomeStatementHistoryQuarterly → netIncome / shares
            const sharesOut = ks.sharesOutstanding || null;
            if (summary.incomeStatementHistoryQuarterly?.incomeStatementHistory && sharesOut) {
              for (const stmt of summary.incomeStatementHistoryQuarterly.incomeStatementHistory) {
                if (stmt.endDate && stmt.netIncome != null) {
                  const d = new Date(stmt.endDate);
                  const y = d.getFullYear(); const m = d.getMonth();
                  const key = `${y}Q${m <= 2 ? 1 : m <= 5 ? 2 : m <= 8 ? 3 : 4}`;
                  if (!qEpsMap.has(key)) {
                    const eps = stmt.netIncome / sharesOut;
                    if (isFinite(eps)) qEpsMap.set(key, eps);
                  }
                }
              }
            }

            console.log(`[PEG] ${ticker}: ${qEpsMap.size} quarterly EPS points`);

            // 최근 8분기 이상이면 trailing PEG 계산 가능
            if (qEpsMap.size >= 8) {
              const sortedKeys = Array.from(qEpsMap.keys()).sort();
              const latest = sortedKeys[sortedKeys.length - 1];
              const idx = sortedKeys.indexOf(latest);
              if (idx >= 7) {
                let trailing4Q = 0;
                for (let j = idx; j >= idx - 3; j--) trailing4Q += qEpsMap.get(sortedKeys[j]) || 0;
                let prev4Q = 0;
                for (let j = idx - 4; j >= idx - 7; j--) prev4Q += qEpsMap.get(sortedKeys[j]) || 0;

                if (Math.abs(prev4Q) > 0.001 && trailing4Q > 0) {
                  const epsGrowthPct = ((trailing4Q - prev4Q) / Math.abs(prev4Q)) * 100;
                  const currentPrice = q.regularMarketPrice || 0;
                  const pe = currentPrice / trailing4Q;
                  if (pe > 0 && epsGrowthPct > 0) {
                    computedPeg = Math.round((pe / epsGrowthPct) * 100) / 100;
                    pegPE = Math.round(pe * 100) / 100;
                    pegEpsGrowth = Math.round(epsGrowthPct * 10) / 10;
                    console.log(`[PEG] ${ticker}: PE=${pegPE}, growth=${pegEpsGrowth}%, PEG=${computedPeg}`);
                  }
                }
              }
            }

            // 분기 데이터 부족 → 연간 EPS fallback
            if (computedPeg == null) {
              const annualStmts = (summary.incomeStatementHistory || {}).incomeStatementHistory || [];
              if (annualStmts.length >= 2) {
                const sorted = [...annualStmts].sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
                const curr = sorted[sorted.length - 1];
                const prev = sorted[sorted.length - 2];
                const currEps = curr.dilutedEPS || (curr.netIncome && sharesOut ? curr.netIncome / sharesOut : null);
                const prevEps = prev.dilutedEPS || (prev.netIncome && sharesOut ? prev.netIncome / sharesOut : null);
                if (currEps && prevEps && Math.abs(prevEps) > 0.001 && currEps > 0) {
                  const growth = ((currEps - prevEps) / Math.abs(prevEps)) * 100;
                  const currentPrice = q.regularMarketPrice || 0;
                  const pe = currentPrice / currEps;
                  if (pe > 0 && growth > 0) {
                    computedPeg = Math.round((pe / growth) * 100) / 100;
                    pegPE = Math.round(pe * 100) / 100;
                    pegEpsGrowth = Math.round(growth * 10) / 10;
                    console.log(`[PEG] ${ticker}: annual fallback PE=${pegPE}, growth=${pegEpsGrowth}%, PEG=${computedPeg}`);
                  }
                }
              }
            }

            // 마지막 fallback: Yahoo의 forward PEG
            if (computedPeg == null && ks.pegRatio && ks.pegRatio > 0) {
              computedPeg = Math.round(ks.pegRatio * 100) / 100;
              console.log(`[PEG] ${ticker}: yahoo forward PEG=${computedPeg}`);
            }
          } catch (e) {
            console.log(`[PEG] calc failed for ${ticker}:`, e.message);
          }

          detail = {
            pegRatio: computedPeg,
            pegPE: pegPE,
            pegEpsGrowth: pegEpsGrowth,
            beta: ks.beta || null,
            enterpriseToRevenue: ks.enterpriseToRevenue || null,
            returnOnEquity: fd.returnOnEquity || null,
            returnOnAssets: fd.returnOnAssets || null,
            debtToEquity: fd.debtToEquity || null,
            currentRatio: fd.currentRatio || null,
            operatingMargins: fd.operatingMargins || null,
            profitMargins: fd.profitMargins || null,
            revenueGrowth: fd.revenueGrowth || null,
            earningsGrowth: fd.earningsGrowth || null,
            freeCashflow: fd.freeCashflow || null,
            payoutRatio: sd.payoutRatio || null,
            // ── 애널리스트 목표가 ──
            targetMeanPrice: fd.targetMeanPrice || null,
            targetHighPrice: fd.targetHighPrice || null,
            targetLowPrice: fd.targetLowPrice || null,
            numberOfAnalysts: fd.numberOfAnalystOpinions || null,
            recommendationKey: fd.recommendationKey || null,
          };

          // ── 간이 DCF 적정가 계산 ──
          try {
            const eps = q.epsTrailingTwelveMonths;
            const fwdEps = q.epsForward;
            if (eps && eps > 0) {
              // 성장률: forward EPS 기반 또는 earningsGrowth 사용
              let growthRate = 0.05; // 기본 5%
              if (fwdEps && fwdEps > eps) {
                growthRate = Math.min((fwdEps - eps) / eps, 0.30); // 최대 30% 캡
              } else if (fd.earningsGrowth && fd.earningsGrowth > 0) {
                growthRate = Math.min(fd.earningsGrowth, 0.30);
              }

              // 할인율: 무위험 수익률 4% + 리스크 프리미엄 (beta 기반)
              const beta = ks.beta || 1.0;
              const discountRate = 0.04 + beta * 0.055; // CAPM: Rf + β × ERP

              // 5년 성장기 + 영구 성장 2.5%
              const terminalGrowth = 0.025;
              let dcfValue = 0;
              let projectedEps = eps;

              // 5년 성장기 EPS 현재가치 합산
              for (let yr = 1; yr <= 5; yr++) {
                projectedEps *= (1 + growthRate);
                dcfValue += projectedEps / Math.pow(1 + discountRate, yr);
              }

              // 터미널 밸류 (5년차 EPS × (1+g) / (r-g))
              const terminalValue = (projectedEps * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
              dcfValue += terminalValue / Math.pow(1 + discountRate, 5);

              detail.dcfFairValue = Math.round(dcfValue * 100) / 100;
              detail.dcfGrowthRate = Math.round(growthRate * 1000) / 10; // %
              detail.dcfDiscountRate = Math.round(discountRate * 1000) / 10; // %
              console.log(`[DCF] ${ticker}: fairValue=$${detail.dcfFairValue}, growth=${detail.dcfGrowthRate}%, discount=${detail.dcfDiscountRate}%`);
            }
          } catch (e) {
            console.log(`DCF calc failed for ${ticker}:`, e.message);
          }

          // ── 실적 발표일 ──
          try {
            const cal = summary.calendarEvents || {};
            const earningsDates = cal.earnings?.earningsDate || [];
            if (earningsDates.length > 0) {
              detail.earningsDate = new Date(earningsDates[0]).toISOString();
            }
          } catch (e) {
            console.log(`earningsDate failed for ${ticker}:`, e.message);
          }

          // ── 5년 중위 P/E 계산 (bulletproof) ──
          try {
            // 연도별 PE를 Map으로 관리 (중복 방지)
            const peByYear = new Map(); // year → pe
            const sharesOutstanding = ks.sharesOutstanding || null;

            // 가격 히스토리 가져오기 (historical 또는 chart 폴백)
            let hist = [];
            try {
              const fiveYearsAgo = new Date();
              fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
              hist = await yahooFinance.historical(ticker, {
                period1: fiveYearsAgo, interval: "1mo",
              });
            } catch (histErr) {
              console.log(`[5Y PE] ${ticker}: historical() failed: ${histErr.message}, trying chart()`);
              try {
                const chartResult = await yahooFinance.chart(ticker, {
                  period1: new Date(Date.now() - 5 * 365.25 * 86400000),
                  interval: "1mo",
                });
                if (chartResult?.quotes) hist = chartResult.quotes;
              } catch (chartErr) {
                console.log(`[5Y PE] ${ticker}: chart() also failed: ${chartErr.message}`);
              }
            }
            console.log(`[5Y PE] ${ticker}: ${hist.length} monthly prices`);

            // 연도별 평균가격 미리 계산
            const yearPriceMap = {};
            for (const h of hist) {
              const close = h.close || h.adjclose;
              if (!close) continue;
              const yr = new Date(h.date).getFullYear();
              if (!yearPriceMap[yr]) yearPriceMap[yr] = [];
              yearPriceMap[yr].push(close);
            }
            const yearAvgPrice = {};
            for (const [yr, prices] of Object.entries(yearPriceMap)) {
              if (prices.length >= 2) {
                yearAvgPrice[yr] = prices.reduce((a, b) => a + b, 0) / prices.length;
              }
            }
            console.log(`[5Y PE] ${ticker}: years with prices: ${Object.keys(yearAvgPrice).join(",")}`);

            // ── 방법A: incomeStatementHistory의 netIncome/shares ──
            const annualStmts = (summary.incomeStatementHistory || {}).incomeStatementHistory || [];
            for (const stmt of annualStmts) {
              const eps = stmt.dilutedEPS || stmt.dilutedEps
                || (stmt.netIncome != null && sharesOutstanding ? stmt.netIncome / sharesOutstanding : null);
              if (!eps || eps <= 0) continue;
              const yr = new Date(stmt.endDate).getFullYear();
              const avgP = yearAvgPrice[yr];
              if (!avgP) continue;
              const pe = Math.round((avgP / eps) * 10) / 10;
              if (pe > 0 && pe < 500 && !peByYear.has(yr)) {
                peByYear.set(yr, pe);
              }
            }
            console.log(`[5Y PE] ${ticker}: after methodA (stmts): ${peByYear.size} years`);

            // ── 방법B: earningsHistory 분기 EPS 합산 (4분기 미만이어도 비례 환산) ──
            if (summary.earningsHistory?.history) {
              const ehByYear = {};
              for (const h of summary.earningsHistory.history) {
                if (h.epsActual != null && h.quarter) {
                  const yr = new Date(h.quarter).getFullYear();
                  if (!ehByYear[yr]) ehByYear[yr] = [];
                  ehByYear[yr].push(h.epsActual);
                }
              }
              for (const [yr, epsArr] of Object.entries(ehByYear)) {
                if (peByYear.has(Number(yr))) continue; // 이미 있으면 스킵
                if (epsArr.length < 2) continue;
                // 분기 수에 비례해서 연간 EPS 추정 (예: 3분기 → ×4/3)
                const annualEps = (epsArr.reduce((a, b) => a + b, 0) / epsArr.length) * 4;
                if (annualEps <= 0) continue;
                const avgP = yearAvgPrice[yr];
                if (!avgP) continue;
                const pe = Math.round((avgP / annualEps) * 10) / 10;
                if (pe > 0 && pe < 500) peByYear.set(Number(yr), pe);
              }
              console.log(`[5Y PE] ${ticker}: after methodB (earnings): ${peByYear.size} years`);
            }

            // ── 방법C (핵심 폴백): 연도별 평균가격 / 현재 EPS — 항상 실행 ──
            const currentEPS = q.epsTrailingTwelveMonths;
            if (currentEPS && currentEPS > 0) {
              for (const [yr, avgP] of Object.entries(yearAvgPrice)) {
                if (peByYear.has(Number(yr))) continue; // 이미 있으면 스킵
                const pe = Math.round((avgP / currentEPS) * 10) / 10;
                if (pe > 0 && pe < 500) peByYear.set(Number(yr), pe);
              }
              console.log(`[5Y PE] ${ticker}: after methodC (price/eps): ${peByYear.size} years`);
            }

            // ── 현재 P/E 반드시 포함 ──
            const currentYear = new Date().getFullYear();
            if (q.trailingPE && q.trailingPE > 0 && !peByYear.has(currentYear)) {
              peByYear.set(currentYear, Math.round(q.trailingPE * 10) / 10);
            }

            // ── 중위값 계산 ──
            const yearlyPEs = Array.from(peByYear.values());
            console.log(`[5Y PE] ${ticker}: final ${yearlyPEs.length} PEs = ${yearlyPEs.join(",")}`);

            if (yearlyPEs.length >= 2) {
              yearlyPEs.sort((a, b) => a - b);
              const mid = Math.floor(yearlyPEs.length / 2);
              const medianPE = yearlyPEs.length % 2 === 0
                ? (yearlyPEs[mid - 1] + yearlyPEs[mid]) / 2
                : yearlyPEs[mid];
              detail.avgPE5Y = Math.round(medianPE * 10) / 10;
              detail.yearlyPEs = yearlyPEs;
              console.log(`[5Y PE] ${ticker}: median=${detail.avgPE5Y}`);
            } else if (yearlyPEs.length === 1) {
              // 1개뿐이면 그것이라도 사용
              detail.avgPE5Y = yearlyPEs[0];
              detail.yearlyPEs = yearlyPEs;
              console.log(`[5Y PE] ${ticker}: single PE=${detail.avgPE5Y}`);
            } else if (q.trailingPE && q.trailingPE > 0) {
              // 모든 방법 실패해도 현재 trailingPE라도 보여줌
              detail.avgPE5Y = Math.round(q.trailingPE * 10) / 10;
              detail.yearlyPEs = [detail.avgPE5Y];
              console.log(`[5Y PE] ${ticker}: ultimate fallback → trailingPE=${detail.avgPE5Y}`);
            }
          } catch (e) {
            console.log(`5Y avg PE calc failed for ${ticker}:`, e.message);
            // 최후의 보루: trailingPE 사용
            if (q.trailingPE && q.trailingPE > 0) {
              detail.avgPE5Y = Math.round(q.trailingPE * 10) / 10;
              detail.yearlyPEs = [detail.avgPE5Y];
              console.log(`[5Y PE] ${ticker}: exception fallback → trailingPE=${detail.avgPE5Y}`);
            }
          }
        } catch (e) {
          console.log(`quoteSummary failed for ${ticker}:`, e.message);
        }

        const scores = computeScore(q);
        const grade = getGrade(scores.total);
        const bargain = computeBargainScore(q);

        // 개별 종목: 캐시 없음 (항상 최신 데이터)
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.json({
          ticker: q.symbol,
          name: q.shortName || q.longName || getName(ticker),
          price: q.regularMarketPrice,
          marketCap: q.marketCap,
          pe: q.trailingPE || null,
          forwardPE: q.forwardPE || null,
          pb: q.priceToBook || null,
          divYield: q.trailingAnnualDividendYield || q.dividendYield || null,
          eps: q.epsTrailingTwelveMonths || null,
          epsForward: q.epsForward || null,
          w52change: q.fiftyTwoWeekChangePercent || null,
          w52high: q.fiftyTwoWeekHigh || null,
          w52low: q.fiftyTwoWeekLow || null,
          ma50: q.fiftyDayAverage || null,
          ma200: q.twoHundredDayAverage || null,
          ...detail,
          scores,
          grade,
          oversold: scores.oversold,
          bargain,
          categoryGrades: {
            profit: getCategoryGrade(scores.profit, 30),
            growth: getCategoryGrade(scores.growth, 25),
            value: getCategoryGrade(scores.value, 20),
            health: getCategoryGrade(scores.health, 15),
            dividend: getCategoryGrade(scores.dividend, 10),
          },
        });
        return;
      }

      // ── 랭킹 모드 ──
      if (mode === "ranking") {
        const today = todayKST();

        // Firestore 캐시 확인 (v4: SUILE 투자매력도 채점철학)
        const CACHE_VERSION = "v7";
        try {
          const doc = await db.collection("stockScoreCache").doc("daily").get();
          if (doc.exists) {
            const data = doc.data();
            if (data.updatedAt === today && data.version === CACHE_VERSION && data.rankings) {
              console.log(`[StockScore] Serving cached ranking from ${today}`);
              // 랭킹 (캐시 히트): 브라우저 1시간 + CDN 24시간
              res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
              res.json({ updatedAt: today, rankings: JSON.parse(data.rankings) });
              return;
            }
          }
        } catch (e) {
          console.log("Firestore read failed, will rebuild:", e.message);
        }

        // 캐시 없음 → 전체 조회
        console.log(`[StockScore] Building ranking for ${SP500.length} stocks...`);
        const quotes = await batchQuote(SP500, 30);
        console.log(`[StockScore] Got ${quotes.length} quotes`);

        const rankings = quotes
          .map((q) => {
            if (!q || !q.symbol) return null;
            try {
              const scores = computeScore(q);
              const bargain = computeBargainScore(q);
              return {
                ticker: q.symbol,
                name: q.shortName || q.longName || getName(q.symbol),
                marketCap: q.marketCap || 0,
                price: q.regularMarketPrice || 0,
                pe: q.trailingPE || null,
                pb: q.priceToBook || null,
                peg: getPEGValue(q),
                divYield: q.trailingAnnualDividendYield || q.dividendYield || null,
                w52change: q.fiftyTwoWeekChangePercent || null,
                score: scores.total,
                grade: getGrade(scores.total),
                value: scores.value,
                growth: scores.growth,
                profit: scores.profit,
                health: scores.health,
                dividend: scores.dividend,
                dropFromHigh: scores.oversold.dropFromHigh,
                isOversold: scores.oversold.isOversold,
                bargainScore: bargain.bargainScore,
                volumeRatio: bargain.volumeRatio,
                near52Low: bargain.near52Low,
              };
            } catch { return null; }
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        // Firestore에 저장
        try {
          await db.collection("stockScoreCache").doc("daily").set({
            updatedAt: today,
            version: CACHE_VERSION,
            rankings: JSON.stringify(rankings),
            count: rankings.length,
          });
          console.log(`[StockScore] Cached ${rankings.length} rankings for ${today}`);
        } catch (e) {
          console.error("Firestore write failed:", e.message);
        }

        // 랭킹 (신규 빌드): 브라우저 1시간 + CDN 24시간
        res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
        res.json({ updatedAt: today, rankings });
        return;
      }

      res.status(400).json({ error: "Missing mode=ranking or ticker=SYMBOL" });
    } catch (err) {
      console.error("stockScore failed:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================
// stockScoreView - 동적 OG HTML
// /ss?t=AAPL&s=85&g=A
// ============================================
exports.stockScoreView = onRequest(
  { region: "asia-northeast3", memory: "128MiB", maxInstances: 10 },
  async (req, res) => {
    const t = String(req.query.t || "");
    const s = String(req.query.s || "");
    const g = String(req.query.g || "");
    const n = String(req.query.n || t);

    const title = `${n} 투자 성적표`;
    const description = `${n}의 가치·성장·수익성·안정성·배당 종합 평가 결과를 확인하세요! S&P 500 전체 랭킹도 한눈에.`;
    const ogImageUrl = `${SITE_URL}/stock-score-og.png`;
    const redirectUrl = `${SITE_URL}/tools/stock-score?ticker=${encodeURIComponent(t)}`;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${title}</title>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:image" content="${ogImageUrl}"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${description}"/>
<meta name="twitter:image" content="${ogImageUrl}"/>
<meta http-equiv="refresh" content="0;url=${redirectUrl}"/>
</head><body><p>Redirecting...</p><script>location.href="${redirectUrl}";</script></body></html>`;

    res.set("Content-Type", "text/html; charset=utf-8");
    // OG 뷰: 브라우저 1시간 + CDN 24시간
    res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.send(html);
  }
);
