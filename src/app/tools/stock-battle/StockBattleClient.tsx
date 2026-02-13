"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TrendingUp, Swords, RotateCcw, Copy, Check, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdSlot } from "@/components/ads/AdSlot";
import { useI18n } from "@/components/i18n/I18nProvider";
import { TickerSearch } from "./TickerSearch";
import { BattleAnimation } from "./BattleAnimation";
import { BattleChart } from "./BattleChart";
import { StockLogo } from "./StockLogo";
import { initAudio } from "./sfx";

interface PricePoint {
  date: string;
  close: number;
}

interface StockResult {
  ticker: string;
  name: string;
  prices: PricePoint[];
}

interface BattleResult {
  a: StockResult;
  b: StockResult;
}

/** Cloud Function 직접 호출 (CORS 허용됨) */
const STOCK_API_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/stockBattle";

type ViewState = "input" | "animating" | "result";

/** 금액 포맷 */
function formatKRW(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

export function StockBattleClient() {
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── 입력 상태 ──
  const [tickerA, setTickerA] = useState(searchParams.get("a") || "");
  const [tickerB, setTickerB] = useState(searchParams.get("b") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "2020-01-01");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "2025-12-31");
  const [amount, setAmount] = useState(searchParams.get("amt") || "1000000");

  // ── 뷰 상태 ──
  const [view, setView] = useState<ViewState>("input");
  const [result, setResult] = useState<BattleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // URL 파라미터 있으면 자동 실행
  useEffect(() => {
    if (searchParams.get("a") && searchParams.get("b")) {
      fetchBattle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBattle = useCallback(async () => {
    if (!tickerA || !tickerB) return;
    await initAudio(); // 사용자 클릭 → AudioContext 생성 + WAV 프리로드
    setLoading(true);
    setError(null);
    setResult(null);
    setView("input");

    const params = new URLSearchParams({
      a: tickerA, b: tickerB, from: dateFrom, to: dateTo, amt: amount,
    });
    router.replace(`/tools/stock-battle?${params.toString()}`, { scroll: false });

    try {
      const res = await fetch(
        `${STOCK_API_URL}?a=${encodeURIComponent(tickerA)}&b=${encodeURIComponent(tickerB)}&from=${dateFrom}&to=${dateTo}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "API 오류");
      }
      const data: BattleResult = await res.json();
      if (!data.a.prices.length || !data.b.prices.length) {
        throw new Error(locale === "ko" ? "해당 기간에 데이터가 없습니다." : "No data for this period.");
      }
      setResult(data);
      setView("animating"); // 바로 배틀 애니메이션 시작!
    } catch (err: any) {
      setError(err.message || "데이터를 가져올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [tickerA, tickerB, dateFrom, dateTo, amount, router, locale]);

  const reset = () => {
    setTickerA("");
    setTickerB("");
    setResult(null);
    setError(null);
    setView("input");
    router.replace("/tools/stock-battle", { scroll: false });
  };

  const copyLink = async () => {
    // /sb URL을 사용하면 OG 미리보기가 동적으로 생성됨
    const params = new URLSearchParams({
      a: tickerA, b: tickerB, from: dateFrom, to: dateTo, amt: amount,
    });
    const url = `${window.location.origin}/sb?${params.toString()}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const investAmount = parseInt(amount) || 1000000;

  const calcReturn = (prices: PricePoint[]) => {
    if (!prices.length) return { finalAmount: 0, returnPct: 0 };
    const s = prices[0].close;
    const e = prices[prices.length - 1].close;
    return { returnPct: ((e - s) / s) * 100, finalAmount: investAmount * (e / s) };
  };

  // ============================
  // 2) 배틀 애니메이션 화면
  // ============================
  if (view === "animating" && result) {
    return (
      <div className="space-y-4">
        <BattleAnimation
          dataA={result.a}
          dataB={result.b}
          investAmount={investAmount}
          onComplete={() => setView("result")}
        />
      </div>
    );
  }

  // ============================
  // 3) 최종 결과 화면
  // ============================
  if (view === "result" && result) {
    const retA = calcReturn(result.a.prices);
    const retB = calcReturn(result.b.prices);
    const winnerIsA = retA.returnPct >= retB.returnPct;
    const winner = winnerIsA ? result.a : result.b;
    const winnerRet = winnerIsA ? retA : retB;

    return (
      <div className="space-y-6">
        {/* 헤더: 로고 VS 로고 */}
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-4 mb-3">
            <StockLogo ticker={result.a.ticker} name={result.a.name} size={40} />
            <span className="text-sm font-bold text-muted-foreground">VS</span>
            <StockLogo ticker={result.b.ticker} name={result.b.name} size={40} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {result.a.name} vs {result.b.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateFrom} ~ {dateTo} | {locale === "ko" ? "투자액" : "Investment"} {formatKRW(investAmount)}{locale === "ko" ? "원" : ""}
          </p>
        </div>

        {/* 승자 */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 text-center shadow-lg">
          <p className="text-sm opacity-80 mb-2">{locale === "ko" ? "최종 승자" : "Winner"}</p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <StockLogo ticker={winner.ticker} name={winner.name} size={36} className="ring-2 ring-white/30" />
            <span className="text-2xl font-bold">{winner.name}</span>
          </div>
          <p className="text-lg">
            {winnerRet.returnPct >= 0 ? "+" : ""}{winnerRet.returnPct.toFixed(1)}% ({formatKRW(Math.round(winnerRet.finalAmount))}{locale === "ko" ? "원" : ""})
          </p>
        </div>

        {/* 양쪽 비교 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl border-2 p-4 text-center ${winnerIsA ? "border-emerald-400 bg-emerald-50" : "border-zinc-200 bg-zinc-50"}`}>
            <StockLogo ticker={result.a.ticker} name={result.a.name} size={32} className="mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-0.5">{result.a.ticker}</p>
            <p className="font-bold text-sm">{result.a.name}</p>
            <p className={`text-lg font-bold mt-2 ${retA.returnPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {retA.returnPct >= 0 ? "+" : ""}{retA.returnPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatKRW(Math.round(retA.finalAmount))}{locale === "ko" ? "원" : ""}
            </p>
          </div>
          <div className={`rounded-xl border-2 p-4 text-center ${!winnerIsA ? "border-emerald-400 bg-emerald-50" : "border-zinc-200 bg-zinc-50"}`}>
            <StockLogo ticker={result.b.ticker} name={result.b.name} size={32} className="mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-0.5">{result.b.ticker}</p>
            <p className="font-bold text-sm">{result.b.name}</p>
            <p className={`text-lg font-bold mt-2 ${retB.returnPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {retB.returnPct >= 0 ? "+" : ""}{retB.returnPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatKRW(Math.round(retB.finalAmount))}{locale === "ko" ? "원" : ""}
            </p>
          </div>
        </div>

        {/* 최종 차트 */}
        <BattleChart dataA={result.a} dataB={result.b} investAmount={investAmount} />

        {/* 공유 + 새로하기 */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyLink} className="flex-1 h-11 gap-2 text-sm">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? (locale === "ko" ? "복사 완료!" : "Copied!") : (locale === "ko" ? "링크 복사" : "Copy Link")}
          </Button>
          <Button variant="ghost" onClick={reset} className="flex-1 h-11 gap-2 text-sm">
            <RotateCcw className="h-4 w-4" />
            {locale === "ko" ? "새로 배틀" : "New Battle"}
          </Button>
        </div>

        <AdSlot />
      </div>
    );
  }

  // ============================
  // 1) 입력 화면
  // ============================
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="text-center py-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white mb-4">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          {locale === "ko" ? "주식 배틀" : "Stock Battle"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
          {locale === "ko"
            ? "두 종목의 수익률을 대결시켜 보세요!"
            : "Battle the returns of two stocks!"}
        </p>
      </div>

      {/* 투자액 */}
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

      {/* 종목 A */}
      <TickerSearch
        value={tickerA}
        onChange={(t) => setTickerA(t)}
        label={locale === "ko" ? "종목 A" : "Stock A"}
        placeholder={locale === "ko" ? "종목명 또는 티커 검색 (예: 애플, AAPL)" : "Search stock name or ticker..."}
      />

      {/* VS 구분 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100">
          <Swords className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-bold text-zinc-500">VS</span>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* 종목 B */}
      <TickerSearch
        value={tickerB}
        onChange={(t) => setTickerB(t)}
        label={locale === "ko" ? "종목 B" : "Stock B"}
        placeholder={locale === "ko" ? "종목명 또는 티커 검색 (예: 삼성전자, TSLA)" : "Search stock name or ticker..."}
      />

      {/* 기간 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{locale === "ko" ? "시작일" : "Start"}</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{locale === "ko" ? "종료일" : "End"}</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11" />
        </div>
      </div>

      {/* 기간 프리셋 */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: locale === "ko" ? "최근 1년" : "1Y", from: getYearsAgo(1), to: today() },
          { label: locale === "ko" ? "최근 3년" : "3Y", from: getYearsAgo(3), to: today() },
          { label: locale === "ko" ? "최근 5년" : "5Y", from: getYearsAgo(5), to: today() },
          { label: "2020~2024", from: "2020-01-01", to: "2024-12-31" },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
            className="px-2.5 py-1 rounded-full text-xs border bg-white hover:bg-zinc-50 border-zinc-200 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 배틀 시작 */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t sm:relative sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
        <Button
          onClick={fetchBattle}
          disabled={!tickerA || !tickerB || loading}
          className="w-full h-12 text-base gap-2 bg-emerald-600 hover:bg-emerald-700"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {locale === "ko" ? "데이터 로딩중..." : "Loading..."}
            </>
          ) : (
            <>
              <Swords className="h-4 w-4" />
              {locale === "ko" ? "배틀 시작!" : "Start Battle!"}
            </>
          )}
        </Button>
      </div>

      {/* SEO */}
      <section className="space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">
          {locale === "ko" ? "주식 배틀이란?" : "What is Stock Battle?"}
        </h2>
        <p>
          {locale === "ko"
            ? "두 종목의 과거 수익률을 비교하는 시뮬레이터입니다. 같은 금액을 투자했다면 어떤 종목이 더 높은 수익을 냈을지 확인해보세요. 미국 주식과 한국 주식, 비트코인·이더리움까지 모두 지원합니다."
            : "A simulator that compares historical returns of two stocks. See which stock would have earned more if you invested the same amount. Supports US stocks, Korean stocks, and even Bitcoin & Ethereum."}
        </p>
      </section>
    </div>
  );
}

// ── 유틸 ──
function today(): string {
  return new Date().toISOString().split("T")[0];
}

function getYearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().split("T")[0];
}
