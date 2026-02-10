"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Trophy, Zap } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StockLogo } from "./StockLogo";

interface PricePoint { date: string; close: number; }
interface StockResult { ticker: string; name: string; prices: PricePoint[]; }
interface BattleAnimationProps {
  dataA: StockResult;
  dataB: StockResult;
  investAmount: number;
  onComplete: () => void;
}

function formatKRW(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

interface ChartRow {
  idx: number;
  retA: number;
  retB: number;
  valA: number;
  valB: number;
  date: string;
}

function buildData(a: StockResult, b: StockResult, amt: number): ChartRow[] {
  const mapA = new Map(a.prices.map((p) => [p.date, p.close]));
  const mapB = new Map(b.prices.map((p) => [p.date, p.close]));
  const dates = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();
  const s1 = a.prices[0]?.close || 1, s2 = b.prices[0]?.close || 1;
  let la = s1, lb = s2;
  return dates.map((date, idx) => {
    const ca = mapA.get(date) ?? la, cb = mapB.get(date) ?? lb;
    la = ca; lb = cb;
    return {
      idx, date,
      retA: Math.round(((ca - s1) / s1) * 1000) / 10,
      retB: Math.round(((cb - s2) / s2) * 1000) / 10,
      valA: Math.round(amt * (ca / s1)),
      valB: Math.round(amt * (cb / s2)),
    };
  });
}

interface LeadChange { index: number; newLeader: "A" | "B"; }
function findLeadChanges(data: ChartRow[]): LeadChange[] {
  const c: LeadChange[] = [];
  let leader: "A" | "B" | null = null;
  for (let i = 0; i < data.length; i++) {
    const cur = data[i].retA >= data[i].retB ? "A" : "B";
    if (leader && cur !== leader) c.push({ index: i, newLeader: cur });
    leader = cur;
  }
  return c;
}

type Phase = "intro" | "racing" | "finish" | "winner";

export function BattleAnimation({ dataA, dataB, investAmount, onComplete }: BattleAnimationProps) {
  const { locale } = useI18n();
  const allData = useRef(buildData(dataA, dataB, investAmount));
  const leadChanges = useRef(findLeadChanges(allData.current));
  const total = allData.current.length;

  const [phase, setPhase] = useState<Phase>("intro");
  const [countdown, setCountdown] = useState(3);
  const [visibleCount, setVisibleCount] = useState(1);
  const [leadFlash, setLeadFlash] = useState<"A" | "B" | null>(null);
  const [lcSeen, setLcSeen] = useState(0);
  const startRef = useRef(0);
  const animRef = useRef<number | null>(null);

  const cur = allData.current[Math.min(visibleCount - 1, total - 1)];
  const leaderIsA = cur.retA >= cur.retB;
  const final = allData.current[total - 1];
  const winnerIsA = final.retA >= final.retB;

  // ── Intro countdown ──
  useEffect(() => {
    if (phase !== "intro") return;
    if (countdown <= 0) { setPhase("racing"); startRef.current = performance.now(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Racing animation ──
  useEffect(() => {
    if (phase !== "racing" && phase !== "finish") return;

    const RACE_MS = phase === "racing" ? 18000 : 6000;

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      let p = Math.min(elapsed / RACE_MS, 1);

      if (phase === "racing") {
        // 가속 → 감속 (easeInOutCubic)
        p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const target = Math.max(1, Math.floor(p * total * 0.8));
        setVisibleCount(target);
        if (elapsed >= RACE_MS) {
          setPhase("finish");
          startRef.current = performance.now();
          return;
        }
      } else {
        // 마지막 20% 천천히
        p = 1 - Math.pow(1 - p, 4);
        const base = Math.floor(total * 0.8);
        setVisibleCount(Math.min(total, base + Math.floor(p * (total - base))));
        if (elapsed >= RACE_MS) {
          setVisibleCount(total);
          setPhase("winner");
          return;
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, total]);

  // ── Lead change detection ──
  useEffect(() => {
    const seen = leadChanges.current.filter((lc) => lc.index <= visibleCount - 1);
    if (seen.length > lcSeen) {
      const latest = seen[seen.length - 1];
      setLeadFlash(latest.newLeader);
      setLcSeen(seen.length);
      setTimeout(() => setLeadFlash(null), 1200);
    }
  }, [visibleCount, lcSeen]);

  // ── Winner → onComplete ──
  useEffect(() => {
    if (phase !== "winner") return;
    const t = setTimeout(onComplete, 4000);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const chartData = allData.current.slice(0, visibleCount);
  const pct = Math.round((visibleCount / total) * 100);

  // ── 풀스크린 경기장 래퍼 ──
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0b] text-white flex flex-col overflow-hidden select-none">

      {/* ── INTRO ── */}
      {phase === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          {/* 두 선수 */}
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center gap-2 animate-in slide-in-from-left duration-500">
              <StockLogo ticker={dataA.ticker} name={dataA.name} size={56} className="ring-2 ring-emerald-500" />
              <span className="text-sm font-bold text-emerald-400">{dataA.name}</span>
              <span className="text-[10px] font-mono text-zinc-500">{dataA.ticker}</span>
            </div>
            <div className="text-2xl font-black text-zinc-500 animate-pulse">VS</div>
            <div className="flex flex-col items-center gap-2 animate-in slide-in-from-right duration-500">
              <StockLogo ticker={dataB.ticker} name={dataB.name} size={56} className="ring-2 ring-indigo-500" />
              <span className="text-sm font-bold text-indigo-400">{dataB.name}</span>
              <span className="text-[10px] font-mono text-zinc-500">{dataB.ticker}</span>
            </div>
          </div>
          {/* 카운트다운 */}
          <div className="text-8xl font-black tabular-nums animate-in zoom-in duration-300" key={countdown}>
            {countdown}
          </div>
          <p className="text-xs text-zinc-500">{locale === "ko" ? "배틀 시작" : "Battle Start"}</p>
        </div>
      )}

      {/* ── RACING / FINISH / WINNER ── */}
      {phase !== "intro" && (
        <>
          {/* 상단: 스코어보드 */}
          <div className="flex items-stretch gap-2 p-3 pt-[max(env(safe-area-inset-top),12px)]">
            {/* Player A */}
            <div className={`flex-1 rounded-xl p-2.5 flex items-center gap-2.5 transition-all duration-300 ${
              leaderIsA
                ? "bg-emerald-950/80 ring-1 ring-emerald-500/60"
                : "bg-zinc-900/80"
            } ${leadFlash === "A" ? "animate-pulse ring-2 ring-emerald-400" : ""}`}>
              <StockLogo ticker={dataA.ticker} name={dataA.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-zinc-400 truncate">{dataA.name}</div>
                <div className={`text-lg font-black tabular-nums leading-tight ${
                  cur.retA >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {cur.retA >= 0 ? "+" : ""}{cur.retA.toFixed(1)}%
                </div>
              </div>
              {leaderIsA && phase !== "winner" && (
                <div className="w-1.5 h-8 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>

            {/* 중앙 VS */}
            <div className="flex items-center justify-center w-8 shrink-0">
              {phase === "finish" ? (
                <Zap className="h-4 w-4 text-orange-400 animate-pulse" />
              ) : (
                <span className="text-[10px] font-bold text-zinc-600">VS</span>
              )}
            </div>

            {/* Player B */}
            <div className={`flex-1 rounded-xl p-2.5 flex items-center gap-2.5 transition-all duration-300 ${
              !leaderIsA
                ? "bg-indigo-950/80 ring-1 ring-indigo-500/60"
                : "bg-zinc-900/80"
            } ${leadFlash === "B" ? "animate-pulse ring-2 ring-indigo-400" : ""}`}>
              <StockLogo ticker={dataB.ticker} name={dataB.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-zinc-400 truncate">{dataB.name}</div>
                <div className={`text-lg font-black tabular-nums leading-tight ${
                  cur.retB >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {cur.retB >= 0 ? "+" : ""}{cur.retB.toFixed(1)}%
                </div>
              </div>
              {!leaderIsA && phase !== "winner" && (
                <div className="w-1.5 h-8 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </div>
          </div>

          {/* 금액 표시 */}
          <div className="flex justify-between px-5 text-[10px] text-zinc-500 tabular-nums">
            <span>{formatKRW(cur.valA)}{locale === "ko" ? "원" : ""}</span>
            <span>{formatKRW(cur.valB)}{locale === "ko" ? "원" : ""}</span>
          </div>

          {/* 게이지 배틀 바 */}
          {phase !== "winner" && <GaugeBattle retA={cur.retA} retB={cur.retB} nameA={dataA.name} nameB={dataB.name} />}

          {/* 차트 영역 */}
          <div className="flex-1 px-2 py-1 min-h-0">
            {phase === "winner" ? (
              /* ── Winner reveal ── */
              <div className="h-full flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-700">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full bg-yellow-500/20 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-yellow-500/30">
                    <Trophy className="h-10 w-10 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-500 mb-1 uppercase tracking-widest">
                    {locale === "ko" ? "승자" : "Winner"}
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <StockLogo
                      ticker={winnerIsA ? dataA.ticker : dataB.ticker}
                      name={winnerIsA ? dataA.name : dataB.name}
                      size={44}
                      className="ring-2 ring-yellow-500"
                    />
                    <h2 className="text-3xl font-black">
                      {winnerIsA ? dataA.name : dataB.name}
                    </h2>
                  </div>
                  <p className={`text-3xl font-black tabular-nums ${
                    (winnerIsA ? final.retA : final.retB) >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {(winnerIsA ? final.retA : final.retB) >= 0 ? "+" : ""}
                    {(winnerIsA ? final.retA : final.retB).toFixed(1)}%
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {formatKRW(investAmount)}{locale === "ko" ? "원" : ""} →{" "}
                    {formatKRW(winnerIsA ? final.valA : final.valB)}{locale === "ko" ? "원" : ""}
                  </p>
                  {leadChanges.current.length > 0 && (
                    <p className="text-xs text-orange-400 mt-3 font-medium flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3" />
                      {locale === "ko"
                        ? `${leadChanges.current.length}번의 역전!`
                        : `${leadChanges.current.length} lead change(s)!`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* ── Live Chart ── */
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <ReferenceLine y={0} stroke="#27272a" strokeWidth={1} />
                  <Area
                    type="monotone"
                    dataKey="retA"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gA)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="retB"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gB)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 하단: 타임라인 */}
          {phase !== "winner" && (
            <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] space-y-1.5">
              {phase === "finish" && (
                <div className="text-center">
                  <span className="inline-block px-3 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[11px] font-bold animate-pulse uppercase tracking-wider">
                    {locale === "ko" ? "막판 스퍼트" : "Final Sprint"}
                  </span>
                </div>
              )}
              <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    phase === "finish" ? "bg-orange-500" : "bg-zinc-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600 tabular-nums">
                <span>{cur.date}</span>
                <span>{pct}%</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 게이지 배틀 바 ──
function GaugeBattle({
  retA, retB, nameA, nameB,
}: {
  retA: number; retB: number; nameA: string; nameB: string;
}) {
  // 수익률을 양수 기준으로 변환 (최소 0.1% 확보)
  const absA = Math.max(Math.abs(retA), 0.1);
  const absB = Math.max(Math.abs(retB), 0.1);

  // 비율 계산: 양쪽이 둘 다 양수면 직접 비교, 아니면 절대값 비교
  let ratioA: number;
  if (retA >= 0 && retB >= 0) {
    ratioA = absA / (absA + absB);
  } else if (retA < 0 && retB < 0) {
    // 둘 다 마이너스: 덜 잃은 쪽이 우세
    ratioA = absB / (absA + absB);
  } else {
    // 한쪽만 플러스: 플러스인 쪽이 무조건 우세
    ratioA = retA >= retB ? 0.5 + (absA / (absA + absB)) * 0.5 : 0.5 - (absB / (absA + absB)) * 0.5;
  }
  const pctA = Math.max(8, Math.min(92, ratioA * 100));
  const aWins = retA >= retB;

  return (
    <div className="px-4 py-1.5">
      <div className="relative h-6 rounded-full overflow-hidden bg-zinc-800/50 flex">
        {/* A 영역 */}
        <div
          className="h-full transition-all duration-500 ease-out flex items-center justify-start pl-2"
          style={{
            width: `${pctA}%`,
            background: aWins
              ? "linear-gradient(90deg, #065f46, #10b981)"
              : "linear-gradient(90deg, #1c1917, #374151)",
          }}
        >
          <span className={`text-[10px] font-bold tabular-nums whitespace-nowrap ${
            aWins ? "text-emerald-200" : "text-zinc-500"
          }`}>
            {Math.round(pctA)}%
          </span>
        </div>
        {/* B 영역 */}
        <div
          className="h-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
          style={{
            width: `${100 - pctA}%`,
            background: !aWins
              ? "linear-gradient(90deg, #6366f1, #312e81)"
              : "linear-gradient(90deg, #374151, #1c1917)",
          }}
        >
          <span className={`text-[10px] font-bold tabular-nums whitespace-nowrap ${
            !aWins ? "text-indigo-200" : "text-zinc-500"
          }`}>
            {Math.round(100 - pctA)}%
          </span>
        </div>
        {/* 중앙선 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/20 transition-all duration-500"
          style={{ left: `${pctA}%` }}
        />
      </div>
    </div>
  );
}
