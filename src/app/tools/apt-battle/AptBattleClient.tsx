"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Share2, Loader2, Building2, Trophy, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { AptSearch, AptSelection } from "./AptSearch";
import { AptBattleChart } from "./AptBattleChart";
import { AptBattleAnimation } from "./AptBattleAnimation";
import { getFullRegionName } from "./region-codes";
import { useSearchParams } from "next/navigation";

const APT_BATTLE_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/aptBattle";
const SITE_URL = "https://suile-21173.web.app";

interface PricePoint {
  date: string;
  price: number;
  pricePerPyeong: number;
}
interface AptBattleData {
  name: string;
  area: number;
  lawdCd: string;
  prices: PricePoint[];
}
interface BattleResult {
  a: AptBattleData;
  b: AptBattleData;
}

type Phase = "input" | "loading" | "animating" | "result";

const YEAR_OPTIONS = [3, 5, 10];

// 빠른 비교 프리셋
const PRESETS = [
  {
    label: "🏙️ 강남 빅매치",
    a: { lawdCd: "11680", name: "은마", area: 76, dong: "대치동", regionName: "서울 강남구" },
    b: { lawdCd: "11650", name: "래미안퍼스티지", area: 84, dong: "반포동", regionName: "서울 서초구" },
  },
  {
    label: "🌉 한강뷰 대결",
    a: { lawdCd: "11650", name: "반포자이", area: 84, dong: "반포동", regionName: "서울 서초구" },
    b: { lawdCd: "11650", name: "아크로리버파크", area: 84, dong: "반포동", regionName: "서울 서초구" },
  },
  {
    label: "🏢 송파 vs 강남",
    a: { lawdCd: "11710", name: "잠실엘스", area: 84, dong: "잠실동", regionName: "서울 송파구" },
    b: { lawdCd: "11680", name: "래미안대치팰리스", area: 84, dong: "대치동", regionName: "서울 강남구" },
  },
];

export default function AptBattleClient() {
  const { t } = useI18n();
  const searchParams = useSearchParams();

  // URL 파라미터로부터 초기값
  const urlA = searchParams.get("a");
  const urlB = searchParams.get("b");

  const [aptA, setAptA] = useState<AptSelection | null>(
    urlA
      ? {
          lawdCd: searchParams.get("la") || "",
          name: urlA,
          area: parseInt(searchParams.get("aa") || "84"),
          dong: "",
          regionName: getFullRegionName(searchParams.get("la") || ""),
        }
      : null
  );
  const [aptB, setAptB] = useState<AptSelection | null>(
    urlB
      ? {
          lawdCd: searchParams.get("lb") || "",
          name: urlB,
          area: parseInt(searchParams.get("ab") || "84"),
          dong: "",
          regionName: getFullRegionName(searchParams.get("lb") || ""),
        }
      : null
  );
  const [years, setYears] = useState(5);
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<BattleResult | null>(null);
  const [error, setError] = useState("");

  // 배틀 시작
  const startBattle = useCallback(
    async (a: AptSelection, b: AptSelection, y: number) => {
      setError("");
      setPhase("loading");
      try {
        const url = `${APT_BATTLE_URL}?lawdCdA=${a.lawdCd}&aptA=${encodeURIComponent(a.name)}&areaA=${a.area}&lawdCdB=${b.lawdCd}&aptB=${encodeURIComponent(b.name)}&areaB=${b.area}&years=${y}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("데이터를 불러올 수 없습니다");
        const data = await res.json();
        if (
          (!data.a?.prices?.length && !data.b?.prices?.length)
        ) {
          throw new Error("실거래 데이터가 없습니다. 다른 아파트를 선택해주세요.");
        }
        setResult(data);
        setPhase("animating");
      } catch (err: any) {
        setError(err.message || "오류가 발생했습니다");
        setPhase("input");
      }
    },
    []
  );

  // URL 파라미터 자동 배틀
  const autoStarted = useMemo(() => {
    if (urlA && urlB && aptA && aptB && phase === "input") {
      startBattle(aptA, aptB, years);
      return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnimComplete = useCallback(() => setPhase("result"), []);

  // 공유 링크
  const shareUrl = useMemo(() => {
    if (!aptA || !aptB) return "";
    return `${SITE_URL}/ab?a=${encodeURIComponent(aptA.name)}&la=${aptA.lawdCd}&aa=${aptA.area}&b=${encodeURIComponent(aptB.name)}&lb=${aptB.lawdCd}&ab=${aptB.area}`;
  }, [aptA, aptB]);

  const handleShare = useCallback(async () => {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${aptA?.name} vs ${aptB?.name} - 아파트 배틀`,
          text: `${aptA?.name} vs ${aptB?.name} 어디가 더 올랐을까? 🏠`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("링크가 복사되었습니다!");
      }
    } catch { /* user cancelled */ }
  }, [shareUrl, aptA, aptB]);

  const resetBattle = () => {
    setPhase("input");
    setResult(null);
  };

  // 결과 계산
  const summaryA = useMemo(() => {
    if (!result?.a?.prices?.length) return null;
    const first = result.a.prices[0];
    const last = result.a.prices[result.a.prices.length - 1];
    const change = ((last.pricePerPyeong - first.pricePerPyeong) / first.pricePerPyeong) * 100;
    return { first, last, change };
  }, [result]);

  const summaryB = useMemo(() => {
    if (!result?.b?.prices?.length) return null;
    const first = result.b.prices[0];
    const last = result.b.prices[result.b.prices.length - 1];
    const change = ((last.pricePerPyeong - first.pricePerPyeong) / first.pricePerPyeong) * 100;
    return { first, last, change };
  }, [result]);

  const winner = useMemo(() => {
    if (!summaryA || !summaryB) return null;
    if (summaryA.change > summaryB.change) return "A";
    if (summaryB.change > summaryA.change) return "B";
    return "draw";
  }, [summaryA, summaryB]);

  // ── 애니메이션 ──
  if (phase === "animating" && result) {
    return (
      <AptBattleAnimation
        dataA={result.a}
        dataB={result.b}
        regionA={aptA?.regionName || ""}
        regionB={aptB?.regionName || ""}
        onComplete={handleAnimComplete}
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* 헤더 */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 bg-emerald-50 px-4 py-1.5 rounded-full">
          <Building2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-700">아파트 배틀</span>
        </div>
        <p className="text-xs text-muted-foreground">
          전국 아파트 실거래가로 평당가 상승률 대결!
        </p>
      </div>

      {/* ── 입력 / 로딩 ── */}
      {(phase === "input" || phase === "loading") && (
        <>
          {/* 빠른 프리셋 */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setAptA(p.a);
                  setAptB(p.b);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {/* A */}
            <AptSearch
              value={aptA}
              onChange={setAptA}
              label="🏠 아파트 A"
              color="#059669"
            />
            {/* B */}
            <AptSearch
              value={aptB}
              onChange={setAptB}
              label="🏠 아파트 B"
              color="#7c3aed"
            />

            {/* 기간 선택 */}
            <div className="flex items-center gap-2 justify-center">
              <span className="text-xs text-muted-foreground">비교 기간</span>
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    years === y
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            {/* 배틀 시작 버튼 */}
            <Button
              onClick={() => aptA && aptB && startBattle(aptA, aptB, years)}
              disabled={!aptA || !aptB || phase === "loading"}
              className="w-full h-12 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-600 to-violet-600 hover:from-emerald-700 hover:to-violet-700"
            >
              {phase === "loading" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  데이터 불러오는 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Swords className="h-5 w-5" />
                  배틀 시작!
                </span>
              )}
            </Button>
          </div>
        </>
      )}

      {/* ── 결과 ── */}
      {phase === "result" && result && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          {/* 승자 배너 */}
          {winner && winner !== "draw" && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <span className="text-lg font-black">
                {winner === "A" ? result.a.name : result.b.name} 승리!
              </span>
            </div>
          )}
          {winner === "draw" && (
            <div className="text-center py-3">
              <span className="text-lg font-black">무승부! ⚖️</span>
            </div>
          )}

          {/* 카드 비교 */}
          <div className="grid grid-cols-2 gap-3">
            {/* A */}
            <div
              className={`rounded-xl border p-3 space-y-1.5 ${
                winner === "A" ? "ring-2 ring-emerald-500 bg-emerald-50/50" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  {result.a.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{result.a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{aptA?.regionName}</p>
                </div>
                {winner === "A" && <Trophy className="h-4 w-4 text-yellow-500 ml-auto" />}
              </div>
              {summaryA && (
                <>
                  <p className={`text-xl font-black ${summaryA.change >= 0 ? "text-red-500" : "text-blue-500"}`}>
                    {summaryA.change >= 0 ? "+" : ""}
                    {summaryA.change.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    평당 {Math.round(summaryA.first.pricePerPyeong).toLocaleString()}만
                    <ArrowRight className="inline h-3 w-3 mx-0.5" />
                    {Math.round(summaryA.last.pricePerPyeong).toLocaleString()}만
                  </p>
                </>
              )}
            </div>

            {/* B */}
            <div
              className={`rounded-xl border p-3 space-y-1.5 ${
                winner === "B" ? "ring-2 ring-violet-500 bg-violet-50/50" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm">
                  {result.b.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{result.b.name}</p>
                  <p className="text-[10px] text-muted-foreground">{aptB?.regionName}</p>
                </div>
                {winner === "B" && <Trophy className="h-4 w-4 text-yellow-500 ml-auto" />}
              </div>
              {summaryB && (
                <>
                  <p className={`text-xl font-black ${summaryB.change >= 0 ? "text-red-500" : "text-blue-500"}`}>
                    {summaryB.change >= 0 ? "+" : ""}
                    {summaryB.change.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    평당 {Math.round(summaryB.first.pricePerPyeong).toLocaleString()}만
                    <ArrowRight className="inline h-3 w-3 mx-0.5" />
                    {Math.round(summaryB.last.pricePerPyeong).toLocaleString()}만
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 차트 */}
          {result.a.prices.length > 0 && result.b.prices.length > 0 && (
            <div className="bg-white rounded-xl border p-3">
              <h3 className="text-xs font-bold mb-2">📈 평당가 추이</h3>
              <AptBattleChart
                nameA={result.a.name}
                nameB={result.b.name}
                pricesA={result.a.prices}
                pricesB={result.b.prices}
              />
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <Button
              onClick={handleShare}
              variant="outline"
              className="flex-1 h-11 rounded-xl text-sm font-bold"
            >
              <Share2 className="h-4 w-4 mr-1.5" />
              공유하기
            </Button>
            <Button
              onClick={resetBattle}
              className="flex-1 h-11 rounded-xl text-sm font-bold bg-zinc-900"
            >
              <Swords className="h-4 w-4 mr-1.5" />
              다시 배틀
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
