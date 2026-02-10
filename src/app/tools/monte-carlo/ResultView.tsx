"use client";

import { useState } from "react";
import { Share2, Copy, Check, RotateCcw, ChevronDown, TrendingUp, TrendingDown, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/ads/AdSlot";
import { StockLogo } from "../stock-battle/StockLogo";
import { FanChart } from "./FanChart";
import type { SimulationResult } from "./monte-carlo-engine";

interface ResultViewProps {
  result: SimulationResult;
  ticker: string;
  displayName: string;
  investAmount: number;
  forecastYears: string;
  lookbackYears: string;
  locale: string;
  onShare: () => void;
  onCopy: () => void;
  onReset: () => void;
  copied: boolean;
}

function formatKRW(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return Math.round(n).toLocaleString("ko-KR");
}

// ── 투자 등급 계산 ──
function getGrade(profitProb: number, medianRetPct: number): {
  grade: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  labelEn: string;
} {
  // profitProb (0~1), medianRetPct (%)
  const score = profitProb * 60 + Math.min(medianRetPct, 100) * 0.4;

  if (score >= 80) return { grade: "S", emoji: "🔥", color: "text-amber-500", bgColor: "bg-amber-50", borderColor: "border-amber-300", label: "압도적 기대", labelEn: "Outstanding" };
  if (score >= 60) return { grade: "A", emoji: "🚀", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-300", label: "매우 유망", labelEn: "Very Promising" };
  if (score >= 40) return { grade: "B", emoji: "👍", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-300", label: "괜찮은 편", labelEn: "Decent" };
  if (score >= 25) return { grade: "C", emoji: "🤔", color: "text-zinc-600", bgColor: "bg-zinc-50", borderColor: "border-zinc-300", label: "보통", labelEn: "Average" };
  if (score >= 10) return { grade: "D", emoji: "😰", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-300", label: "위험 주의", labelEn: "Risky" };
  return { grade: "F", emoji: "💀", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-300", label: "매우 위험", labelEn: "Very Risky" };
}

// ── 돈 벌 확률 이모지 ──
function getProbEmoji(prob: number): string {
  if (prob >= 0.8) return "🎯";
  if (prob >= 0.6) return "😊";
  if (prob >= 0.5) return "🙂";
  if (prob >= 0.4) return "😐";
  if (prob >= 0.3) return "😟";
  return "😱";
}

// ── 수익률에 따른 한줄평 ──
function getComment(medianRetPct: number, profitProb: number, locale: string): string {
  if (locale !== "ko") {
    if (medianRetPct > 100 && profitProb > 0.7) return "Incredible potential! But remember, high returns come with high risk.";
    if (medianRetPct > 50) return "Strong growth expected. Worth considering!";
    if (medianRetPct > 20) return "Steady growth potential. A solid pick.";
    if (medianRetPct > 0) return "Modest gains expected. Consider your risk tolerance.";
    if (medianRetPct > -20) return "Slightly negative outlook. Proceed with caution.";
    return "Historical data suggests significant downside risk.";
  }
  if (medianRetPct > 100 && profitProb > 0.7) return "미쳤다... 역사가 반복된다면 대박 가능성! 하지만 과거가 미래를 보장하진 않아요.";
  if (medianRetPct > 50 && profitProb > 0.6) return "꽤 기대되는 종목이네요! 성장 가능성이 높아 보입니다.";
  if (medianRetPct > 20) return "안정적인 성장이 예상돼요. 나쁘지 않은 선택!";
  if (medianRetPct > 0) return "소소하게 벌 수 있을 것 같아요. 리스크는 적은 편.";
  if (medianRetPct > -10) return "본전치기 수준... 다른 종목도 고려해보세요.";
  if (medianRetPct > -30) return "마이너스 가능성이 꽤 있어요. 신중하게 판단하세요.";
  return "역사적으로 하락세가 강합니다. 정말 괜찮겠어요?";
}

export function ResultView({
  result,
  ticker,
  displayName,
  investAmount,
  forecastYears,
  lookbackYears,
  locale,
  onShare,
  onCopy,
  onReset,
  copied,
}: ResultViewProps) {
  const [showMore, setShowMore] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const grade = getGrade(result.profitProbability, result.medianReturnPct);
  const probPct = Math.round(result.profitProbability * 100);
  const probEmoji = getProbEmoji(result.profitProbability);
  const comment = getComment(result.medianReturnPct, result.profitProbability, locale);

  const gain = result.medianFinal - investAmount;
  const isPositive = gain >= 0;

  return (
    <div className="space-y-5">
      {/* ── 헤더: 종목 + 조건 ── */}
      <div className="text-center pt-2">
        <StockLogo ticker={ticker} name={displayName} size={52} className="mx-auto mb-3" />
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatKRW(investAmount)}원 / {forecastYears}년 예측
        </p>
      </div>

      {/* ── 투자 등급 카드 ── */}
      <div className={`rounded-2xl border-2 ${grade.borderColor} ${grade.bgColor} p-5 text-center`}>
        <div className="text-4xl mb-1">{grade.emoji}</div>
        <div className={`text-5xl font-black ${grade.color} mb-1`}>{grade.grade}</div>
        <p className={`text-sm font-bold ${grade.color}`}>
          {locale === "ko" ? grade.label : grade.labelEn}
        </p>
      </div>

      {/* ── 한줄평 ── */}
      <div className="rounded-xl bg-white border p-4 text-center">
        <p className="text-sm font-medium leading-relaxed">{comment}</p>
      </div>

      {/* ── 보통이면 얼마? (메인 결과) ── */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 text-white p-5 text-center shadow-lg">
        <p className="text-sm opacity-80 mb-1">
          {locale === "ko" ? "보통이면 이 정도 예상" : "Expected Result"}
        </p>
        <p className="text-3xl font-black mb-1">{formatKRW(Math.round(result.medianFinal))}원</p>
        <div className="flex items-center justify-center gap-1.5">
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span className="text-lg font-bold">
            {isPositive ? "+" : ""}{formatKRW(Math.abs(Math.round(gain)))}원
            <span className="text-sm opacity-80 ml-1">
              ({result.medianReturnPct >= 0 ? "+" : ""}{result.medianReturnPct.toFixed(1)}%)
            </span>
          </span>
        </div>
      </div>

      {/* ── 3가지 시나리오 ── */}
      <div className="space-y-2.5 relative">
        {/* 운 좋으면 */}
        <div className="flex items-center gap-3 rounded-xl border bg-emerald-50 border-emerald-200 p-3.5">
          <span className="text-2xl shrink-0">🍀</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-emerald-700 font-medium">
              {locale === "ko" ? "운이 좋으면" : "Best case"}
            </p>
            <p className="text-lg font-bold text-emerald-700">{formatKRW(Math.round(result.p90Final))}원</p>
          </div>
          <span className="text-sm font-semibold text-emerald-600 shrink-0 mr-1">
            +{((result.p90Final - investAmount) / investAmount * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => setTooltip(tooltip === "p90" ? null : "p90")}
            className="shrink-0 w-6 h-6 rounded-full bg-emerald-200/60 flex items-center justify-center hover:bg-emerald-300/60 transition-colors"
          >
            <Info className="h-3.5 w-3.5 text-emerald-700" />
          </button>
        </div>
        {tooltip === "p90" && (
          <div className="rounded-lg bg-emerald-900 text-white p-3 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold">P90 (90번째 백분위수)</span>
              <button onClick={() => setTooltip(null)}><X className="h-3.5 w-3.5 opacity-60" /></button>
            </div>
            {locale === "ko"
              ? "2,000개 시뮬레이션 중 상위 10%에 해당하는 결과예요. 10번 중 1번 정도 이렇게 좋을 수 있다는 뜻이에요."
              : "Top 10% of 2,000 simulations. About 1 in 10 chance of being this good."}
          </div>
        )}

        {/* 보통이면 */}
        <div className="flex items-center gap-3 rounded-xl border bg-white p-3.5">
          <span className="text-2xl shrink-0">{isPositive ? "😊" : "😐"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">
              {locale === "ko" ? "보통이면" : "Typical case"}
            </p>
            <p className="text-lg font-bold">{formatKRW(Math.round(result.medianFinal))}원</p>
          </div>
          <span className={`text-sm font-semibold shrink-0 mr-1 ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
            {result.medianReturnPct >= 0 ? "+" : ""}{result.medianReturnPct.toFixed(0)}%
          </span>
          <button
            onClick={() => setTooltip(tooltip === "p50" ? null : "p50")}
            className="shrink-0 w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
          >
            <Info className="h-3.5 w-3.5 text-zinc-500" />
          </button>
        </div>
        {tooltip === "p50" && (
          <div className="rounded-lg bg-zinc-800 text-white p-3 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold">P50 (중앙값)</span>
              <button onClick={() => setTooltip(null)}><X className="h-3.5 w-3.5 opacity-60" /></button>
            </div>
            {locale === "ko"
              ? "2,000개 시뮬레이션의 정확히 가운데 값이에요. 절반은 이보다 높고, 절반은 이보다 낮아요. 가장 \"평범한\" 결과라고 보면 돼요."
              : "The exact middle of 2,000 simulations. Half are higher, half are lower. The most \"typical\" outcome."}
          </div>
        )}

        {/* 운 나쁘면 */}
        <div className="flex items-center gap-3 rounded-xl border bg-orange-50 border-orange-200 p-3.5">
          <span className="text-2xl shrink-0">😥</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-orange-700 font-medium">
              {locale === "ko" ? "운이 나쁘면" : "Worst case"}
            </p>
            <p className="text-lg font-bold text-orange-700">{formatKRW(Math.round(result.p10Final))}원</p>
          </div>
          <span className="text-sm font-semibold text-orange-600 shrink-0 mr-1">
            {((result.p10Final - investAmount) / investAmount * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => setTooltip(tooltip === "p10" ? null : "p10")}
            className="shrink-0 w-6 h-6 rounded-full bg-orange-200/60 flex items-center justify-center hover:bg-orange-300/60 transition-colors"
          >
            <Info className="h-3.5 w-3.5 text-orange-700" />
          </button>
        </div>
        {tooltip === "p10" && (
          <div className="rounded-lg bg-orange-900 text-white p-3 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold">P10 (10번째 백분위수)</span>
              <button onClick={() => setTooltip(null)}><X className="h-3.5 w-3.5 opacity-60" /></button>
            </div>
            {locale === "ko"
              ? "2,000개 시뮬레이션 중 하위 10%에 해당하는 결과예요. 10번 중 1번 정도 이만큼 나쁠 수 있다는 뜻이에요. 최악의 경우를 대비할 때 참고하세요."
              : "Bottom 10% of 2,000 simulations. About 1 in 10 chance of being this bad. Use this to prepare for worst case."}
          </div>
        )}
      </div>

      {/* ── 돈 벌 확률 게이지 ── */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">
            {locale === "ko" ? "돈 벌 확률" : "Profit Chance"} {probEmoji}
          </span>
          <span className={`text-xl font-black ${probPct >= 50 ? "text-emerald-600" : "text-red-500"}`}>
            {probPct}%
          </span>
        </div>
        <div className="h-4 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              probPct >= 70 ? "bg-emerald-500" :
              probPct >= 50 ? "bg-emerald-400" :
              probPct >= 40 ? "bg-amber-400" :
              "bg-red-400"
            }`}
            style={{ width: `${probPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>{locale === "ko" ? "손해" : "Loss"}</span>
          <span>50%</span>
          <span>{locale === "ko" ? "수익" : "Profit"}</span>
        </div>
      </div>

      {/* ── 공유 버튼 (가장 눈에 띄게) ── */}
      <div className="flex gap-2">
        <Button onClick={onShare} className="flex-1 h-12 gap-2 text-base bg-violet-600 hover:bg-violet-700">
          <Share2 className="h-5 w-5" />
          {locale === "ko" ? "친구에게 공유" : "Share"}
        </Button>
        <Button variant="outline" onClick={onCopy} className="h-12 px-4">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* ── 광고 ── */}
      <AdSlot />

      {/* ── 더 알아보기 (토글) ── */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
      >
        <Info className="h-4 w-4" />
        {showMore
          ? (locale === "ko" ? "접기" : "Close")
          : (locale === "ko" ? "더 알아보기 (차트 + 통계)" : "Learn More (Chart + Stats)")}
        <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
      </button>

      {showMore && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* 예측 차트 */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="text-sm font-semibold mb-1">
              {locale === "ko" ? "미래 예측 범위" : "Future Prediction Range"}
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              {locale === "ko"
                ? "녹색이 진할수록 가능성이 높은 구간이에요. 빨간 점선이 내 원금."
                : "Darker green = more likely range. Red dashed line = your investment."}
            </p>
            <FanChart
              bands={result.bands}
              investAmount={investAmount}
              lastPrice={result.lastPrice}
              locale={locale}
            />
          </div>

          {/* 상세 통계 */}
          <div className="rounded-xl border bg-zinc-50 p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              {locale === "ko" ? "상세 분석 데이터" : "Detailed Analysis"}
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs block">
                  {locale === "ko" ? "연간 기대수익률" : "Annual Return"}
                  <button onClick={() => setTooltip(tooltip === "mu" ? null : "mu")} className="ml-1 inline-flex"><Info className="h-3 w-3 text-zinc-400" /></button>
                </span>
                <p className="font-semibold">{(result.annualMu * 100).toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">
                  {locale === "ko" ? "연간 변동성" : "Volatility"}
                  <button onClick={() => setTooltip(tooltip === "sigma" ? null : "sigma")} className="ml-1 inline-flex"><Info className="h-3 w-3 text-zinc-400" /></button>
                </span>
                <p className="font-semibold">{(result.annualSigma * 100).toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">{locale === "ko" ? "과거 분석 기간" : "Lookback"}</span>
                <p className="font-semibold">{lookbackYears}{locale === "ko" ? "년" : " years"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">{locale === "ko" ? "시뮬레이션 횟수" : "Simulations"}</span>
                <p className="font-semibold">2,000{locale === "ko" ? "회" : ""}</p>
              </div>
            </div>

            {/* 인라인 툴팁 */}
            {tooltip === "mu" && (
              <div className="mt-3 rounded-lg bg-zinc-800 text-white p-2.5 text-xs leading-relaxed animate-in fade-in">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="font-bold">{locale === "ko" ? "연간 기대수익률 (μ)" : "Annual Expected Return (μ)"}</span>
                  <button onClick={() => setTooltip(null)}><X className="h-3 w-3 opacity-60" /></button>
                </div>
                {locale === "ko"
                  ? "과거 데이터에서 계산한 1년 평균 수익률이에요. 이 숫자가 클수록 역사적으로 잘 올랐다는 뜻이에요."
                  : "Average annual return calculated from historical data. Higher = historically better performance."}
              </div>
            )}
            {tooltip === "sigma" && (
              <div className="mt-3 rounded-lg bg-zinc-800 text-white p-2.5 text-xs leading-relaxed animate-in fade-in">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="font-bold">{locale === "ko" ? "연간 변동성 (σ)" : "Annual Volatility (σ)"}</span>
                  <button onClick={() => setTooltip(null)}><X className="h-3 w-3 opacity-60" /></button>
                </div>
                {locale === "ko"
                  ? "주가가 얼마나 출렁이는지 나타내요. 높으면 \"롤러코스터\", 낮으면 \"평탄한 도로\"라고 생각하면 돼요. 변동성이 높을수록 운 좋으면 대박, 나쁘면 쪽박."
                  : "How much the price swings. High = roller coaster, low = smooth ride. Higher volatility means bigger potential gains AND losses."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 면책 ── */}
      <p className="text-center text-[10px] text-muted-foreground px-4">
        {locale === "ko"
          ? "과거 데이터 기반의 확률 추정이며 실제 미래를 보장하지 않습니다"
          : "Based on historical data and does not guarantee future returns"}
      </p>

      {/* ── 다시하기 ── */}
      <Button onClick={onReset} variant="ghost" className="w-full h-10 gap-2 text-sm text-muted-foreground">
        <RotateCcw className="h-4 w-4" />
        {locale === "ko" ? "다른 종목 해보기" : "Try Another"}
      </Button>
    </div>
  );
}
