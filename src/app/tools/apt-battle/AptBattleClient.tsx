"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Share2, Loader2, Building2, Trophy, ArrowRight, Dice5, ChevronDown } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { AptSearch, AptSelection } from "./AptSearch";
import { AptBattleChart } from "./AptBattleChart";
import { AptBattleAnimation } from "./AptBattleAnimation";
import { getSidoList, getSigunguList, getFullRegionName } from "./region-codes";
import { useSearchParams } from "next/navigation";

const APT_BATTLE_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/aptBattle";
const APT_SEARCH_URL =
  "https://asia-northeast3-suile-21173.cloudfunctions.net/aptSearch";
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

  // 랜덤 매칭
  const [randomSido, setRandomSido] = useState("");
  const [randomCode, setRandomCode] = useState("");
  const [isRandomLoading, setIsRandomLoading] = useState(false);

  const sidoList = getSidoList();
  const sigunguList = randomSido ? getSigunguList(randomSido) : [];

  const handleRandomMatch = useCallback(async () => {
    if (!randomCode) return;
    setIsRandomLoading(true);
    setError("");
    try {
      const res = await fetch(`${APT_SEARCH_URL}?lawdCd=${randomCode}&q=`);
      if (!res.ok) throw new Error("검색 실패");
      const data = await res.json();
      const list = (data.results || []).filter(
        (r: any) => r.txCount >= 2 // 거래 2건 이상만
      );
      if (list.length < 2) {
        throw new Error("해당 지역에 비교할 아파트가 부족합니다. 다른 지역을 선택해주세요.");
      }
      // 랜덤 2개 뽑기 (중복 방지)
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      const regionName = getFullRegionName(randomCode);
      const pickA = shuffled[0];
      const pickB = shuffled[1];
      setAptA({
        lawdCd: randomCode,
        name: pickA.name,
        area: pickA.area,
        dong: pickA.dong,
        regionName,
      });
      setAptB({
        lawdCd: randomCode,
        name: pickB.name,
        area: pickB.area,
        dong: pickB.dong,
        regionName,
      });
    } catch (err: any) {
      setError(err.message || "랜덤 매칭 실패");
    } finally {
      setIsRandomLoading(false);
    }
  }, [randomCode]);

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
  const fmtPrice = (manwon: number) => {
    if (manwon >= 10000) {
      const eok = Math.floor(manwon / 10000);
      const rest = manwon % 10000;
      return rest > 0 ? `${eok}억 ${Math.round(rest / 1000) * 1000 >= 1000 ? Math.round(rest / 1000) + "천" : rest}만` : `${eok}억`;
    }
    return `${manwon.toLocaleString()}만`;
  };

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
          {/* 랜덤 매칭 */}
          <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Dice5 className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-800">랜덤 매칭</span>
              <span className="text-[10px] text-amber-600/70">같은 구에서 랜덤 2개!</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <div className="relative">
                <select
                  value={randomSido}
                  onChange={(e) => { setRandomSido(e.target.value); setRandomCode(""); }}
                  className="w-full h-9 rounded-lg border bg-white px-2.5 text-xs appearance-none cursor-pointer pr-7"
                >
                  <option value="">시/도</option>
                  {sidoList.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "")}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={randomCode}
                  onChange={(e) => setRandomCode(e.target.value)}
                  disabled={!randomSido}
                  className="w-full h-9 rounded-lg border bg-white px-2.5 text-xs appearance-none cursor-pointer pr-7 disabled:opacity-50"
                >
                  <option value="">시/군/구</option>
                  {sigunguList.map((sg) => (
                    <option key={sg.code} value={sg.code}>{sg.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
              <button
                onClick={handleRandomMatch}
                disabled={!randomCode || isRandomLoading}
                className="h-9 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                {isRandomLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Dice5 className="h-3.5 w-3.5" />
                )}
                뽑기
              </button>
            </div>
          </div>

          {/* 또는 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[10px] text-muted-foreground font-medium">또는 직접 선택</span>
            <div className="flex-1 h-px bg-zinc-200" />
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

            {/* 동일 아파트 경고 */}
            {aptA && aptB && aptA.lawdCd === aptB.lawdCd && aptA.name === aptB.name && aptA.area === aptB.area && (
              <p className="text-xs text-amber-600 text-center font-medium">
                ⚠️ 같은 아파트끼리는 비교할 수 없어요. 다른 아파트를 선택해주세요.
              </p>
            )}

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
              disabled={!aptA || !aptB || phase === "loading" || (aptA?.lawdCd === aptB?.lawdCd && aptA?.name === aptB?.name && aptA?.area === aptB?.area)}
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
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">
                      평당 {Math.round(summaryA.first.pricePerPyeong).toLocaleString()}만
                      <ArrowRight className="inline h-3 w-3 mx-0.5" />
                      {Math.round(summaryA.last.pricePerPyeong).toLocaleString()}만
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      매매 {fmtPrice(summaryA.first.price)}
                      <ArrowRight className="inline h-3 w-3 mx-0.5" />
                      {fmtPrice(summaryA.last.price)}
                    </p>
                  </div>
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
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">
                      평당 {Math.round(summaryB.first.pricePerPyeong).toLocaleString()}만
                      <ArrowRight className="inline h-3 w-3 mx-0.5" />
                      {Math.round(summaryB.last.pricePerPyeong).toLocaleString()}만
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      매매 {fmtPrice(summaryB.first.price)}
                      <ArrowRight className="inline h-3 w-3 mx-0.5" />
                      {fmtPrice(summaryB.last.price)}
                    </p>
                  </div>
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
