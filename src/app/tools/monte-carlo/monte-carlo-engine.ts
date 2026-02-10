/**
 * 몬테카를로 시뮬레이션 엔진
 *
 * 기하 브라운 운동(GBM) 기반 주식 미래 가격 시뮬레이션
 * - 과거 일간 종가 → 로그수익률 → μ, σ 추출
 * - S(t+1) = S(t) * exp((μ - σ²/2)Δt + σ√Δt * Z)
 * - 순수 TypeScript, 외부 의존성 없음
 */

// ── 타입 ──

export interface PricePoint {
  date: string;
  close: number;
}

export interface SimulationParams {
  prices: PricePoint[];          // 과거 가격 데이터
  investAmount: number;          // 투자 금액
  forecastDays: number;          // 예측 영업일 수
  numSimulations?: number;       // 시뮬레이션 횟수 (기본 2000)
}

export interface PercentileBand {
  day: number;
  date: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface SimulationResult {
  // 통계
  mu: number;                    // 일간 평균 로그수익률
  sigma: number;                 // 일간 변동성
  annualMu: number;              // 연환산 기대수익률
  annualSigma: number;           // 연환산 변동성

  // 최종 결과 통계
  medianFinal: number;           // 중앙값(P50) 최종 금액
  p10Final: number;              // 비관적(P10) 최종 금액
  p90Final: number;              // 낙관적(P90) 최종 금액
  profitProbability: number;     // 원금 회수 확률 (0~1)
  medianReturnPct: number;       // 중앙값 수익률 %

  // 밴드 데이터 (차트용)
  bands: PercentileBand[];

  // 샘플 경로 (애니메이션용, 20개)
  samplePaths: number[][];

  // 입력값 참조
  investAmount: number;
  forecastDays: number;
  lastPrice: number;
}

// ── Box-Muller 정규 난수 생성 ──

function randomNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── 로그수익률 계산 ──

function calcLogReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return returns;
}

// ── 평균, 표준편차 ──

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], avg: number): number {
  const variance = arr.reduce((sum, val) => sum + (val - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ── 퍼센타일 계산 ──

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── 미래 날짜 생성 (영업일 근사) ──

function generateFutureDates(startDate: string, numDays: number): string[] {
  const dates: string[] = [];
  const d = new Date(startDate);
  let count = 0;
  while (count < numDays) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) { // 주말 제외
      dates.push(d.toISOString().split("T")[0]);
      count++;
    }
  }
  return dates;
}

// ── 메인 시뮬레이션 ──

export function runMonteCarlo(params: SimulationParams): SimulationResult {
  const { prices, investAmount, forecastDays, numSimulations = 2000 } = params;

  // 1) 과거 종가 추출
  const closePrices = prices.map((p) => p.close);
  const lastPrice = closePrices[closePrices.length - 1];
  const lastDate = prices[prices.length - 1].date;

  // 2) 로그수익률, μ, σ 계산
  const logReturns = calcLogReturns(closePrices);
  const mu = mean(logReturns);
  const sigma = stdDev(logReturns, mu);

  // 연환산 (252 영업일 기준)
  const annualMu = mu * 252;
  const annualSigma = sigma * Math.sqrt(252);

  // 3) 미래 날짜 생성
  const futureDates = generateFutureDates(lastDate, forecastDays);

  // 4) 시뮬레이션 실행
  const dt = 1; // 1 영업일
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);

  // allPaths[sim][day] = 가격
  const allFinalPrices: number[] = [];
  const samplePaths: number[][] = [];
  // dayPrices[day] = 해당 날의 모든 시뮬레이션 가격
  const dayPrices: number[][] = Array.from({ length: forecastDays }, () => []);

  for (let sim = 0; sim < numSimulations; sim++) {
    let price = lastPrice;
    const path: number[] = [];

    for (let day = 0; day < forecastDays; day++) {
      const z = randomNormal();
      price = price * Math.exp(drift + diffusion * z);
      path.push(price);
      dayPrices[day].push(price);
    }

    allFinalPrices.push(price);

    // 애니메이션용 샘플 경로 저장 (20개)
    if (sim < 20) {
      samplePaths.push(path);
    }
  }

  // 5) 퍼센타일 밴드 계산
  const bands: PercentileBand[] = futureDates.map((date, dayIdx) => {
    const sorted = [...dayPrices[dayIdx]].sort((a, b) => a - b);
    return {
      day: dayIdx + 1,
      date,
      p10: percentile(sorted, 10),
      p25: percentile(sorted, 25),
      p50: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
    };
  });

  // 6) 최종 통계 계산
  const sortedFinal = [...allFinalPrices].sort((a, b) => a - b);
  const medianFinalPrice = percentile(sortedFinal, 50);
  const p10FinalPrice = percentile(sortedFinal, 10);
  const p90FinalPrice = percentile(sortedFinal, 90);

  // 투자금 기준 환산
  const shares = investAmount / lastPrice;
  const medianFinal = shares * medianFinalPrice;
  const p10Final = shares * p10FinalPrice;
  const p90Final = shares * p90FinalPrice;

  // 원금 회수 확률
  const profitCount = allFinalPrices.filter((p) => p >= lastPrice).length;
  const profitProbability = profitCount / numSimulations;

  // 중앙값 수익률
  const medianReturnPct = ((medianFinalPrice - lastPrice) / lastPrice) * 100;

  return {
    mu,
    sigma,
    annualMu,
    annualSigma,
    medianFinal,
    p10Final,
    p90Final,
    profitProbability,
    medianReturnPct,
    bands,
    samplePaths,
    investAmount,
    forecastDays,
    lastPrice,
  };
}

// ── 예측 기간(년) → 영업일 변환 ──
export function yearsToTradingDays(years: number): number {
  return Math.round(years * 252);
}
