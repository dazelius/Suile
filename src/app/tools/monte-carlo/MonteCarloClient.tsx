"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TrendingUp, Play, RotateCcw, Copy, Check, Loader2, Share2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdSlot } from "@/components/ads/AdSlot";
import { useI18n } from "@/components/i18n/I18nProvider";
import { TickerSearch } from "../stock-battle/TickerSearch";
import { StockLogo } from "../stock-battle/StockLogo";
import { runMonteCarlo, yearsToTradingDays, type SimulationResult, type PricePoint } from "./monte-carlo-engine";
import { SimulationAnimation } from "./SimulationAnimation";
import { ResultView } from "./ResultView";

const HISTORY_API_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/stockHistory";

const SITE_URL = "https://suile-21173.web.app";

type ViewState = "input" | "animating" | "result";

function formatKRW(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return Math.round(n).toLocaleString("ko-KR");
}

export function MonteCarloClient() {
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const autoRanRef = useRef(false);

  // ── 입력 상태 (URL 파라미터에서 초기값) ──
  const [ticker, setTicker] = useState(searchParams.get("ticker") || "");
  const [stockName, setStockName] = useState("");
  const [amount, setAmount] = useState(searchParams.get("amt") || "1000000");
  const [forecastYears, setForecastYears] = useState(searchParams.get("fy") || "3");
  const [lookbackYears, setLookbackYears] = useState(searchParams.get("ly") || "5");

  // ── 뷰 상태 ──
  const [view, setView] = useState<ViewState>("input");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTickerChange = useCallback((t: string, name?: string) => {
    setTicker(t);
    if (name) setStockName(name);
  }, []);

  const runSimulation = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setView("input");

    // URL 파라미터 업데이트
    const params = new URLSearchParams({
      ticker, amt: amount, fy: forecastYears, ly: lookbackYears,
    });
    router.replace(`/tools/monte-carlo?${params.toString()}`, { scroll: false });

    // 과거 데이터 기간 계산
    const lookback = parseFloat(lookbackYears) || 5;
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setFullYear(fromDate.getFullYear() - lookback);
    const from = fromDate.toISOString().split("T")[0];
    const to = today.toISOString().split("T")[0];

    try {
      const res = await fetch(
        `${HISTORY_API_URL}?ticker=${encodeURIComponent(ticker)}&from=${from}&to=${to}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "API 오류");
      }
      const data: { ticker: string; name: string; prices: PricePoint[] } = await res.json();

      if (data.prices.length < 30) {
        throw new Error(
          locale === "ko"
            ? "데이터가 충분하지 않습니다. (최소 30일 필요)"
            : "Not enough data (need at least 30 days)"
        );
      }

      // 종목명 업데이트
      if (data.name && data.name !== ticker) {
        setStockName(data.name);
      }

      // 시뮬레이션 실행
      const forecastDays = yearsToTradingDays(parseFloat(forecastYears) || 3);
      const investAmount = parseInt(amount) || 1000000;

      const simResult = runMonteCarlo({
        prices: data.prices,
        investAmount,
        forecastDays,
        numSimulations: 2000,
      });

      setResult(simResult);
      setView("animating");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [ticker, amount, forecastYears, lookbackYears, locale, router]);

  // URL 파라미터 있으면 자동 실행
  useEffect(() => {
    if (autoRanRef.current) return;
    if (searchParams.get("ticker")) {
      autoRanRef.current = true;
      runSimulation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const investAmount = parseInt(amount) || 1000000;
  const displayName = stockName || ticker;

  // 공유 URL (OG 동적 프리뷰 경유)
  const shareUrl = `${SITE_URL}/mc?ticker=${encodeURIComponent(ticker)}&amt=${amount}&fy=${forecastYears}&ly=${lookbackYears}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName} 미래 예측 - 몬테카를로`,
          text: `${formatKRW(investAmount)}원을 ${forecastYears}년 투자하면? 몬테카를로가 예측한 결과를 확인하세요!`,
          url: shareUrl,
        });
      } catch { /* 취소 */ }
    } else {
      copyLink();
    }
  }, [shareUrl, displayName, investAmount, forecastYears, copyLink]);

  const reset = () => {
    setView("input");
    setResult(null);
    setError(null);
  };

  // ============================
  // 2) 애니메이션
  // ============================
  if (view === "animating" && result) {
    return (
      <SimulationAnimation
        samplePaths={result.samplePaths}
        lastPrice={result.lastPrice}
        investAmount={result.investAmount}
        onComplete={() => setView("result")}
        stockName={displayName}
      />
    );
  }

  // ============================
  // 3) 결과 화면
  // ============================
  if (view === "result" && result) {
    return (
      <ResultView
        result={result}
        ticker={ticker}
        displayName={displayName}
        investAmount={investAmount}
        forecastYears={forecastYears}
        lookbackYears={lookbackYears}
        locale={locale}
        onShare={handleShare}
        onCopy={copyLink}
        onReset={reset}
        copied={copied}
      />
    );
  }

  // ============================
  // 1) 입력 화면
  // ============================
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="text-center py-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white mb-4">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          {locale === "ko" ? "몬테카를로 시뮬레이터" : "Monte Carlo Simulator"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
          {locale === "ko"
            ? "과거 데이터 기반으로 미래 수익률을 예측해보세요"
            : "Predict future returns based on historical data"}
        </p>
      </div>

      {/* 종목 선택 */}
      <TickerSearch
        value={ticker}
        onChange={handleTickerChange}
        label={locale === "ko" ? "종목 선택" : "Select Stock"}
        placeholder={locale === "ko" ? "종목명 또는 티커 검색 (예: NVDA, 삼성전자)" : "Search stock name or ticker..."}
      />

      {/* 투자 금액 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {locale === "ko" ? "투자 금액 (원)" : "Investment Amount"}
        </label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000000"
          className="h-11 text-base"
        />
        <div className="flex gap-1.5 flex-wrap">
          {["100000", "1000000", "10000000", "100000000"].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                amount === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white hover:bg-zinc-50 border-zinc-200"
              }`}
            >
              {formatKRW(parseInt(v))}{locale === "ko" ? "원" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* 기간 설정 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {locale === "ko" ? "예측 기간" : "Forecast Period"}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {["1", "2", "3", "5", "10"].map((v) => (
              <button
                key={v}
                onClick={() => setForecastYears(v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  forecastYears === v
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white hover:bg-zinc-50 border-zinc-200"
                }`}
              >
                {v}{locale === "ko" ? "년" : "yr"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {locale === "ko" ? "분석 기간 (과거)" : "Lookback"}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {["3", "5", "7", "10"].map((v) => (
              <button
                key={v}
                onClick={() => setLookbackYears(v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  lookbackYears === v
                    ? "bg-zinc-800 text-white border-zinc-800"
                    : "bg-white hover:bg-zinc-50 border-zinc-200"
                }`}
              >
                {v}{locale === "ko" ? "년" : "yr"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 시뮬레이션 시작 버튼 */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t sm:relative sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
        <Button
          onClick={runSimulation}
          disabled={!ticker || loading}
          className="w-full h-12 text-base gap-2 bg-violet-600 hover:bg-violet-700"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {locale === "ko" ? "데이터 불러오는 중..." : "Loading data..."}
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {locale === "ko" ? "시뮬레이션 시작!" : "Start Simulation!"}
            </>
          )}
        </Button>
      </div>

      {/* 광고 */}
      <AdSlot />

      {/* SEO */}
      <section className="space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">
          {locale === "ko" ? "몬테카를로 시뮬레이션이란?" : "What is Monte Carlo Simulation?"}
        </h2>
        <p>
          {locale === "ko"
            ? "몬테카를로 시뮬레이션은 과거 주식 데이터의 수익률과 변동성을 분석하여 수천 개의 가능한 미래 가격 경로를 생성하는 통계적 방법입니다. 기하 브라운 운동(GBM) 모델을 사용하여 각 경로를 시뮬레이션하고, 확률 분포를 통해 투자 결과의 가능한 범위를 보여줍니다."
            : "Monte Carlo simulation is a statistical method that analyzes historical stock data returns and volatility to generate thousands of possible future price paths. Using the Geometric Brownian Motion (GBM) model, it simulates each path and shows the possible range of investment outcomes through probability distributions."}
        </p>
        <p>
          {locale === "ko"
            ? "이 도구는 2,000개의 시뮬레이션을 실행하여 P10(비관적), P50(중앙값), P90(낙관적) 등 확률 밴드를 제공합니다. 투자 결정의 참고 자료로 활용하세요."
            : "This tool runs 2,000 simulations to provide probability bands including P10 (pessimistic), P50 (median), and P90 (optimistic). Use as a reference for investment decisions."}
        </p>
      </section>
    </div>
  );
}
