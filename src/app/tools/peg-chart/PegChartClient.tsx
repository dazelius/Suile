"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Loader2, X, BarChart3, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TickerSearch } from "../stock-battle/TickerSearch";
import { StockLogo } from "../stock-battle/StockLogo";
import { PegLineChart } from "./PegLineChart";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useSearchParams } from "next/navigation";

const API_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/pegHistory";

// 종목별 색상
const CHIP_COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

interface SelectedTicker {
  ticker: string;
  name: string;
}

interface TickerData {
  name: string;
  data: { quarter: string; date: string; peg: number; pe: number; epsGrowth: number }[];
}

type ViewState = "input" | "loading" | "result";

export function PegChartClient() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get("embed") === "1";
  const urlTickers = searchParams.get("tickers");

  // 선택된 종목 (최대 5개)
  const [selected, setSelected] = useState<SelectedTicker[]>([]);
  // 티커 검색 임시 value
  const [searchTicker, setSearchTicker] = useState("");

  const [viewState, setViewState] = useState<ViewState>("input");
  const [chartData, setChartData] = useState<Record<string, TickerData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  // 종목 추가
  const addTicker = useCallback(
    (ticker: string, name?: string) => {
      if (!ticker) return;
      // 이미 있으면 추가 안 함
      if (selected.some((s) => s.ticker === ticker)) {
        setSearchTicker("");
        return;
      }
      if (selected.length >= 5) return;
      setSelected((prev) => [...prev, { ticker, name: name || ticker }]);
      setSearchTicker("");
    },
    [selected]
  );

  // 종목 제거
  const removeTicker = (ticker: string) => {
    setSelected((prev) => prev.filter((s) => s.ticker !== ticker));
  };

  // 조회 실행
  const fetchPegData = useCallback(async () => {
    if (selected.length === 0) return;

    setViewState("loading");
    setError(null);
    setChartData(null);

    const tickers = selected.map((s) => s.ticker).join(",");
    try {
      const res = await fetch(`${API_URL}?tickers=${encodeURIComponent(tickers)}`);
      if (!res.ok) throw new Error("API 요청 실패");
      const data = await res.json();

      // 결과 검증
      if (!data.tickers) throw new Error("잘못된 응답 형식");

      // 결과 검증: 모든 종목이 완전히 빈 경우에만 에러
      const totalPoints = Object.values(data.tickers).reduce(
        (sum: number, t: any) => sum + (t.data?.length || 0),
        0
      );
      if (totalPoints === 0) {
        throw new Error(
          locale === "ko"
            ? "선택한 종목의 데이터를 가져올 수 없습니다. 다른 종목을 시도해보세요."
            : "Could not fetch data for the selected tickers. Try different ones."
        );
      }

      setChartData(data.tickers);
      setViewState("result");
    } catch (err: any) {
      setError(err.message || "알 수 없는 오류");
      setViewState("input");
    }
  }, [selected, locale]);

  // URL 파라미터로 자동 로드 (embed 또는 tickers 파라미터)
  useEffect(() => {
    if (autoLoaded || !urlTickers) return;
    const tickers = urlTickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 5);
    if (tickers.length === 0) return;
    setAutoLoaded(true);
    const items = tickers.map((t) => ({ ticker: t, name: t }));
    setSelected(items);
    // 다음 틱에서 fetch 실행
    setTimeout(() => {
      (async () => {
        setViewState("loading");
        setError(null);
        try {
          const params = tickers.map((t) => `tickers=${encodeURIComponent(t)}`).join("&");
          const res = await fetch(`${API_URL}?${params}&lang=${locale}`);
          if (!res.ok) throw new Error("PEG 데이터 조회 실패");
          const data = await res.json();
          setChartData(data.tickers);
          setViewState("result");
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "오류");
          setViewState("input");
        }
      })();
    }, 100);
  }, [urlTickers, autoLoaded, locale]);

  // 뒤로가기
  const handleReset = () => {
    setViewState("input");
    setChartData(null);
    setError(null);
  };

  // embed 모드: 차트만 표시
  if (isEmbed) {
    if (viewState === "loading") {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
        </div>
      );
    }
    if (viewState === "result" && chartData) {
      return (
        <div className="p-2">
          <PegLineChart tickers={chartData} locale={locale} />
        </div>
      );
    }
    if (error) {
      return <div className="text-center text-xs text-red-500 py-4">{error}</div>;
    }
    return <div className="text-center text-xs text-zinc-400 py-4">데이터 로드 중...</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {viewState === "loading" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">
            {locale === "ko"
              ? "분기별 PEG 데이터 불러오는 중..."
              : "Loading quarterly PEG data..."}
          </p>
          <p className="text-xs text-muted-foreground">
            {locale === "ko"
              ? "여러 분기 데이터를 분석하므로 시간이 걸릴 수 있습니다"
              : "This may take a moment as we analyze multiple quarters"}
          </p>
        </div>
      )}

      {viewState === "input" && (
        <>
          {/* PEG 가이드 */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl p-4 border border-violet-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <BarChart3 className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-violet-900">
                  {locale === "ko" ? "PEG 비율이란?" : "What is PEG Ratio?"}
                </h3>
                <p className="text-xs text-violet-700 mt-1 leading-relaxed">
                  {locale === "ko"
                    ? "PEG = PE ÷ EPS 성장률. 성장성 대비 주가가 적정한지 판단하는 지표입니다."
                    : "PEG = PE ÷ EPS Growth Rate. It measures valuation relative to growth."}
                </p>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-xs text-violet-600 font-semibold mt-1.5 flex items-center gap-1 hover:text-violet-800 transition-colors"
                >
                  <Info className="h-3 w-3" />
                  {showGuide
                    ? locale === "ko" ? "접기" : "Less"
                    : locale === "ko" ? "해석 가이드" : "Interpretation Guide"}
                </button>
                {showGuide && (
                  <div className="mt-2 space-y-1 text-xs text-violet-700 animate-in slide-in-from-top-2">
                    <p>• <span className="font-semibold text-emerald-600">PEG &lt; 1</span> → {locale === "ko" ? "저평가 (성장 대비 저렴)" : "Undervalued"}</p>
                    <p>• <span className="font-semibold text-orange-600">PEG = 1</span> → {locale === "ko" ? "적정가 (성장과 가격이 균형)" : "Fairly Valued"}</p>
                    <p>• <span className="font-semibold text-red-600">PEG &gt; 1</span> → {locale === "ko" ? "고평가 (성장 대비 비쌈)" : "Overvalued"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {locale === "ko"
                        ? "* EPS 성장률이 음수면 PEG 계산 불가 (해당 분기 생략)"
                        : "* PEG cannot be calculated when EPS growth is negative"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 선택된 종목 칩 */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((s, idx) => (
                <div
                  key={s.ticker}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-white border shadow-sm"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: CHIP_COLORS[idx % CHIP_COLORS.length] + "20" }}
                  >
                    <StockLogo ticker={s.ticker} name={s.name} size={18} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: CHIP_COLORS[idx % CHIP_COLORS.length] }}>
                    {s.ticker}
                  </span>
                  <button
                    onClick={() => removeTicker(s.ticker)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 종목 검색 */}
          {selected.length < 5 && (
            <div className="relative">
              <TickerSearch
                value={searchTicker}
                onChange={(ticker, name) => addTicker(ticker, name)}
                placeholder={
                  locale === "ko"
                    ? `종목 추가 (${selected.length}/5)... 예: NVDA, 삼성전자`
                    : `Add ticker (${selected.length}/5)... e.g. NVDA, AAPL`
                }
                label={
                  locale === "ko" ? "종목 검색 및 추가" : "Search & Add Tickers"
                }
              />
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 조회 버튼 */}
          <Button
            onClick={fetchPegData}
            disabled={selected.length === 0}
            className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200"
            size="lg"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            {locale === "ko"
              ? `PEG 차트 보기 (${selected.length}개 종목)`
              : `View PEG Chart (${selected.length} tickers)`}
          </Button>

          {/* 추천 종목 */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">
              {locale === "ko" ? "빠른 비교" : "Quick Compare"}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { tickers: ["NVDA", "AMD", "INTC"], label: "AI 반도체" },
                { tickers: ["AAPL", "MSFT", "GOOGL"], label: "빅테크" },
                { tickers: ["TSLA", "META", "NFLX"], label: "성장주" },
              ].map((group) => (
                <button
                  key={group.label}
                  onClick={() => {
                    setSelected(group.tickers.map((t) => ({ ticker: t, name: t })));
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-violet-50 hover:border-violet-300 transition-colors"
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {viewState === "result" && chartData && (
        <div className="space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {locale === "ko" ? "분기별 PEG 비교" : "Quarterly PEG Comparison"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.map((s) => s.ticker).join(" vs ")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset} className="rounded-lg text-xs">
              {locale === "ko" ? "다시 비교" : "New Compare"}
            </Button>
          </div>

          {/* 빈 데이터 경고 */}
          {Object.entries(chartData).some(([, v]) => v.data.length === 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              {locale === "ko"
                ? "⚠ 일부 종목은 EPS 데이터 부족으로 PEG를 계산할 수 없습니다."
                : "⚠ Some tickers have insufficient EPS data for PEG calculation."}
              <div className="mt-1 font-medium">
                {Object.entries(chartData)
                  .filter(([, v]) => v.data.length === 0)
                  .map(([k, v]) => `${k} (${v.name})`)
                  .join(", ")}
              </div>
            </div>
          )}

          {/* 차트 */}
          <div className="bg-white rounded-2xl border p-4 shadow-sm">
            <PegLineChart tickers={chartData} locale={locale} />
          </div>

          {/* 최신 PEG 값 요약 */}
          <div className="grid gap-2">
            {Object.entries(chartData).map(([ticker, data], idx) => {
              if (data.data.length === 0) return null;
              const latest = data.data[data.data.length - 1];
              const pegVal = latest.peg;
              const peVal = latest.pe;
              const isForward = (latest as any).forward;
              const isPeOnly = (latest as any).peOnly;

              let label: string;
              let color: string;
              let bgColor: string;

              if (pegVal != null) {
                if (pegVal < 1) {
                  label = locale === "ko" ? "저평가" : "Undervalued";
                  color = "text-emerald-600";
                  bgColor = "bg-emerald-50";
                } else if (pegVal <= 1.5) {
                  label = locale === "ko" ? "적정~약간 고평가" : "Fair~Slightly Over";
                  color = "text-orange-600";
                  bgColor = "bg-orange-50";
                } else {
                  label = locale === "ko" ? "고평가" : "Overvalued";
                  color = "text-red-600";
                  bgColor = "bg-red-50";
                }
                if (isForward) label += " (fwd)";
              } else {
                label = locale === "ko" ? "PEG 산출 불가" : "PEG N/A";
                color = "text-zinc-500";
                bgColor = "bg-zinc-50";
              }

              return (
                <div
                  key={ticker}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${bgColor}`}
                >
                  <StockLogo ticker={ticker} name={data.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold">{data.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{ticker}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {latest.quarter}
                      {peVal != null && ` · PE ${peVal}`}
                      {latest.epsGrowth != null && ` · ${locale === "ko" ? "성장률" : "Growth"} ${latest.epsGrowth}%`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-black ${color}`}>
                      {pegVal != null ? pegVal.toFixed(2) : (peVal != null ? `PE ${peVal}` : "N/A")}
                    </div>
                    <div className={`text-[10px] font-semibold ${color}`}>
                      {label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 면책 조항 */}
          <p className="text-[10px] text-center text-muted-foreground px-4 leading-relaxed">
            {locale === "ko"
              ? "※ PEG 데이터는 Yahoo Finance 기반이며, 투자 조언이 아닙니다. EPS 데이터 가용성에 따라 표시되는 분기 수가 다를 수 있습니다."
              : "※ PEG data is based on Yahoo Finance and is not investment advice. Number of available quarters may vary by ticker."}
          </p>
        </div>
      )}

    </div>
  );
}
