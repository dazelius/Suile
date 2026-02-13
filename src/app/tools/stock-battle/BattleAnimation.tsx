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
import { Trophy, Zap, TrendingUp, TrendingDown, Flame } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StockLogo } from "./StockLogo";
import { getLogoUrls } from "./stock-logos";

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

/* ── 실시간 해설 생성 ── */
function getCommentary(p: {
  locale: string; nameA: string; nameB: string;
  leaderIsA: boolean; gap: number; isClose: boolean; isVeryClose: boolean;
  momentumA: number; momentumB: number; streak: number;
  isNewHighA: boolean; isNewHighB: boolean;
  drawdownA: number; drawdownB: number;
  phase: Phase; progressRatio: number; warmedUp: boolean; lcSeen: number;
}): string {
  const ko = p.locale === "ko";
  const leader = p.leaderIsA ? p.nameA : p.nameB;
  const chaser = p.leaderIsA ? p.nameB : p.nameA;
  const chaserMom = p.leaderIsA ? p.momentumB : p.momentumA;
  const leaderMom = p.leaderIsA ? p.momentumA : p.momentumB;

  if (!p.warmedUp) {
    return ko ? "레이스 초반, 탐색전 진행 중..." : "Early race, both stocks testing the waters...";
  }
  if (p.phase === "finish") {
    return ko ? "막판 스퍼트! 결과가 곧 나옵니다!" : "Final sprint! The result is coming!";
  }
  // 신고가
  if (p.isNewHighA && p.isNewHighB) {
    return ko ? `양쪽 모두 신고가 행진!` : `Both stocks hitting new highs!`;
  }
  if (p.isNewHighA) {
    return ko ? `${p.nameA} 신고가 갱신! 거침없는 질주!` : `${p.nameA} hits a new high!`;
  }
  if (p.isNewHighB) {
    return ko ? `${p.nameB} 신고가 갱신! 거침없는 질주!` : `${p.nameB} hits a new high!`;
  }
  // 초접전
  if (p.isVeryClose) {
    return ko ? `숨 막히는 초접전! 어느 쪽도 양보 없다!` : `Neck and neck! Neither side is giving in!`;
  }
  // 추격
  if (chaserMom > 0.5 && p.gap < 8) {
    return ko ? `${chaser} 맹추격! 격차가 좁혀지고 있다!` : `${chaser} is closing in fast!`;
  }
  // 독주
  if (p.gap > 15) {
    return ko ? `${leader} 압도적 독주! 격차 ${p.gap.toFixed(1)}%p` : `${leader} dominating! Gap: ${p.gap.toFixed(1)}%p`;
  }
  // 연속 우세
  if (p.streak > 30) {
    return ko ? `${leader} ${p.streak}일 연속 우세 중!` : `${leader} leading for ${p.streak} consecutive days!`;
  }
  // 접전
  if (p.isClose) {
    return ko ? `접전! ${leader}가 근소한 차이로 앞서는 중` : `Close fight! ${leader} barely ahead`;
  }
  // 역전 많으면
  if (p.lcSeen >= 3) {
    return ko ? `시소게임! 벌써 ${p.lcSeen}번의 역전!` : `Back and forth! ${p.lcSeen} reversals so far!`;
  }
  // 리더 모멘텀 강
  if (leaderMom > 0.5) {
    return ko ? `${leader} 가속 중! 격차를 벌리고 있다` : `${leader} accelerating! Widening the gap`;
  }
  // 낙폭 경고
  const leaderDraw = p.leaderIsA ? p.drawdownA : p.drawdownB;
  if (leaderDraw < -3) {
    return ko ? `${leader} 고점 대비 ${Math.abs(leaderDraw).toFixed(1)}%p 하락 중...` : `${leader} down ${Math.abs(leaderDraw).toFixed(1)}%p from peak...`;
  }
  // 기본
  return ko ? `${leader}가 ${p.gap.toFixed(1)}%p 차이로 리드 중` : `${leader} leads by ${p.gap.toFixed(1)}%p`;
}

/* ── 경마 스타일 엔드포인트 아이콘 (SVG) ── */
function RaceIcon({
  cx,
  cy,
  color,
  logoUrl,
  initial,
  clipId,
  isLeader,
}: {
  cx: number;
  cy: number;
  color: string;
  logoUrl: string;
  initial: string;
  clipId: string;
  isLeader: boolean;
}) {
  const R = 17; // 고정 크기 — 리더 전환 시 크기 점프 방지
  return (
    <g>
      {/* Speed trail — 왼쪽으로 뻗는 잔상 (정적) */}
      {[10, 22, 34].map((offset, i) => (
        <circle
          key={i}
          cx={cx - offset}
          cy={cy}
          r={R * (0.5 - i * 0.12)}
          fill={color}
          opacity={0.15 - i * 0.04}
        />
      ))}

      {/* 정적 외곽 글로우 — 애니메이션 없음 */}
      <circle
        cx={cx}
        cy={cy}
        r={R + 4}
        fill="none"
        stroke={color}
        strokeWidth={isLeader ? 1.8 : 1}
        opacity={isLeader ? 0.22 : 0.08}
      />

      {/* Colored border ring */}
      <circle cx={cx} cy={cy} r={R + 1.5} fill={color} />

      {/* White background */}
      <circle cx={cx} cy={cy} r={R} fill="#ffffff" />

      {/* Clip path for circular logo */}
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={R - 0.5} />
        </clipPath>
      </defs>

      {logoUrl ? (
        <image
          href={logoUrl}
          x={cx - R + 0.5}
          y={cy - R + 0.5}
          width={(R - 0.5) * 2}
          height={(R - 0.5) * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={R * 0.75}
          fontWeight="bold"
          fill={color}
        >
          {initial}
        </text>
      )}

      {/* 리더 왕관 표시 */}
      {isLeader && (
        <text
          x={cx}
          y={cy - R - 6}
          textAnchor="middle"
          fontSize={12}
        >
          👑
        </text>
      )}
    </g>
  );
}

/** 여러 후보 URL 중 첫 로드 성공 URL 반환 */
async function resolveLogoUrl(ticker: string): Promise<string> {
  for (const u of getLogoUrls(ticker)) {
    try {
      await new Promise<void>((res, rej) => {
        const img = new Image();
        img.onload = () => res();
        img.onerror = () => rej();
        img.src = u;
      });
      return u;
    } catch {
      /* next */
    }
  }
  return "";
}

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

  // ── 역전! 오버레이 ──
  const [reversalOverlay, setReversalOverlay] = useState<{ leader: "A" | "B"; count: number } | null>(null);

  // ── 로고 URL 해석 ──
  const [logoUrlA, setLogoUrlA] = useState("");
  const [logoUrlB, setLogoUrlB] = useState("");
  useEffect(() => {
    let cancelled = false;
    resolveLogoUrl(dataA.ticker).then((u) => { if (!cancelled) setLogoUrlA(u); });
    resolveLogoUrl(dataB.ticker).then((u) => { if (!cancelled) setLogoUrlB(u); });
    return () => { cancelled = true; };
  }, [dataA.ticker, dataB.ticker]);

  const cur = allData.current[Math.min(visibleCount - 1, total - 1)];
  const leaderIsA = cur.retA >= cur.retB;
  const final = allData.current[total - 1];
  const winnerIsA = final.retA >= final.retB;

  // ── 배틀 강도 계산 ──
  const progressRatio = visibleCount / total;
  const warmedUp = progressRatio > 0.2;
  const gap = Math.abs(cur.retA - cur.retB);
  const isClose = warmedUp && gap < 3;
  const isVeryClose = warmedUp && gap < 1;

  // ── 모멘텀 계산 (최근 5개 데이터 기준) ──
  const prevIdx = Math.max(0, Math.min(visibleCount - 6, total - 1));
  const prev = allData.current[prevIdx];
  const momentumA = cur.retA - prev.retA;
  const momentumB = cur.retB - prev.retB;

  // ── 연속 우세 카운트 ──
  let streak = 0;
  for (let i = Math.min(visibleCount - 1, total - 1); i >= 0; i--) {
    const d = allData.current[i];
    const aLeads = d.retA >= d.retB;
    if (aLeads === leaderIsA) streak++;
    else break;
  }

  // ── 최고 수익률 (현재까지의 High Water Mark) ──
  let peakA = -Infinity, peakB = -Infinity;
  for (let i = 0; i < visibleCount && i < total; i++) {
    if (allData.current[i].retA > peakA) peakA = allData.current[i].retA;
    if (allData.current[i].retB > peakB) peakB = allData.current[i].retB;
  }
  const isNewHighA = cur.retA === peakA && cur.retA > 0 && warmedUp;
  const isNewHighB = cur.retB === peakB && cur.retB > 0 && warmedUp;
  const drawdownA = peakA > 0 ? cur.retA - peakA : 0;
  const drawdownB = peakB > 0 ? cur.retB - peakB : 0;

  // ── 예상 승률 (단순 휴리스틱) ──
  const remaining = 1 - progressRatio;
  const momDiff = momentumA - momentumB;
  const rawWinA = 50 + (cur.retA - cur.retB) * 3 + momDiff * 5 - remaining * 10 * Math.sign(cur.retA - cur.retB);
  const winProbA = Math.max(5, Math.min(95, Math.round(rawWinA)));

  // ── 실시간 해설 ──
  const commentary = getCommentary({
    locale, nameA: dataA.name, nameB: dataB.name,
    leaderIsA, gap, isClose, isVeryClose, momentumA, momentumB,
    streak, isNewHighA, isNewHighB, drawdownA, drawdownB,
    phase, progressRatio, warmedUp, lcSeen,
  });

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
        p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const target = Math.max(1, Math.floor(p * total * 0.8));
        setVisibleCount(target);
        if (elapsed >= RACE_MS) {
          setPhase("finish");
          startRef.current = performance.now();
          return;
        }
      } else {
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

  // ── Lead change detection (역전 감지) ──
  // 초반 20% 구간의 역전은 무시 (양쪽 다 0% 근처라 의미 없음)
  useEffect(() => {
    const minIdx = Math.floor(total * 0.2);
    const seen = leadChanges.current.filter((lc) => lc.index <= visibleCount - 1 && lc.index >= minIdx);
    if (seen.length > lcSeen) {
      const latest = seen[seen.length - 1];
      setLeadFlash(latest.newLeader);
      setReversalOverlay({ leader: latest.newLeader, count: seen.length });
      setLcSeen(seen.length);
      setTimeout(() => setLeadFlash(null), 1500);
      setTimeout(() => setReversalOverlay(null), 2000);
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
  const lastIdx = chartData.length - 1;

  // ── 풀스크린 경기장 래퍼 ──
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0b] text-white flex flex-col overflow-hidden select-none">

      {/* ── 접전 시 화면 가장자리 글로우 ── */}
      {phase !== "intro" && phase !== "winner" && isClose && (
        <div
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-500"
          style={{
            opacity: isVeryClose ? 0.6 : 0.3,
            boxShadow: "inset 0 0 80px 20px rgba(239,68,68,0.15), inset 0 0 120px 40px rgba(249,115,22,0.1)",
          }}
        />
      )}

      {/* ── 역전! 오버레이 ── */}
      {reversalOverlay && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          {/* 배경 플래시 */}
          <div
            className="absolute inset-0 animate-in fade-in duration-200"
            style={{
              background: reversalOverlay.leader === "A"
                ? "radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
            }}
          />
          {/* 텍스트 */}
          <div className="relative animate-in zoom-in-50 duration-300">
            <div
              className="text-5xl font-black tracking-tight"
              style={{
                color: reversalOverlay.leader === "A" ? "#10b981" : "#6366f1",
                textShadow: `0 0 40px ${reversalOverlay.leader === "A" ? "rgba(16,185,129,0.6)" : "rgba(99,102,241,0.6)"}, 0 0 80px ${reversalOverlay.leader === "A" ? "rgba(16,185,129,0.3)" : "rgba(99,102,241,0.3)"}`,
              }}
            >
              {locale === "ko" ? "역전!" : "REVERSAL!"}
            </div>
            <div className="text-center mt-1">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: reversalOverlay.leader === "A" ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.2)",
                  color: reversalOverlay.leader === "A" ? "#6ee7b7" : "#a5b4fc",
                }}
              >
                {reversalOverlay.leader === "A" ? dataA.name : dataB.name} {locale === "ko" ? "역전 성공" : "takes the lead"}
                {reversalOverlay.count > 1 && ` (${reversalOverlay.count}${locale === "ko" ? "번째" : "x"})`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── INTRO ── */}
      {phase === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
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
          <div className="text-8xl font-black tabular-nums animate-in zoom-in duration-300" key={countdown}>
            {countdown}
          </div>
          <p className="text-xs text-zinc-500">{locale === "ko" ? "배틀 시작" : "Battle Start"}</p>
        </div>
      )}

      {/* ── RACING / FINISH / WINNER ── */}
      {phase !== "intro" && (
        <>
          {/* 상단: 스코어보드 (금액 통합) */}
          <div className="flex items-stretch gap-1.5 px-3 pt-[max(env(safe-area-inset-top),12px)] pb-1">
            {/* Player A */}
            <div className={`flex-1 rounded-xl p-2 flex items-center gap-2 transition-all duration-300 ${
              leaderIsA
                ? "bg-emerald-950/80 ring-1 ring-emerald-500/60"
                : "bg-zinc-900/80"
            } ${leadFlash === "A" ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30" : ""}`}>
              <div className="relative shrink-0">
                <StockLogo ticker={dataA.ticker} name={dataA.name} size={32} />
                {leaderIsA && phase !== "winner" && (
                  <div className="absolute -top-1 -right-1 text-[9px]">👑</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                  {dataA.name}
                  {phase !== "winner" && momentumA > 0.3 && <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />}
                  {phase !== "winner" && momentumA < -0.3 && <TrendingDown className="h-2.5 w-2.5 text-red-400" />}
                  {phase !== "winner" && isNewHighA && <span className="text-[8px] text-yellow-400">★</span>}
                </div>
                <div className={`text-base font-black tabular-nums leading-tight ${
                  cur.retA >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {cur.retA >= 0 ? "+" : ""}{cur.retA.toFixed(1)}%
                </div>
                <div className="text-[9px] text-zinc-600 tabular-nums">{formatKRW(cur.valA)}{locale === "ko" ? "원" : ""}</div>
              </div>
            </div>

            {/* 중앙: 배틀 상태 */}
            <div className="flex flex-col items-center justify-center w-10 shrink-0">
              {phase === "winner" ? (
                <Trophy className="h-4 w-4 text-yellow-500" />
              ) : phase === "finish" ? (
                <Zap className="h-4 w-4 text-orange-400 animate-pulse" />
              ) : isVeryClose ? (
                <Flame className="h-4 w-4 text-red-500 animate-pulse" />
              ) : isClose ? (
                <Zap className="h-3.5 w-3.5 text-orange-400" />
              ) : (
                <span className="text-[10px] font-bold text-zinc-600">VS</span>
              )}
            </div>

            {/* Player B */}
            <div className={`flex-1 rounded-xl p-2 flex items-center gap-2 transition-all duration-300 ${
              !leaderIsA
                ? "bg-indigo-950/80 ring-1 ring-indigo-500/60"
                : "bg-zinc-900/80"
            } ${leadFlash === "B" ? "ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/30" : ""}`}>
              <div className="relative shrink-0">
                <StockLogo ticker={dataB.ticker} name={dataB.name} size={32} />
                {!leaderIsA && phase !== "winner" && (
                  <div className="absolute -top-1 -right-1 text-[9px]">👑</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                  {dataB.name}
                  {phase !== "winner" && momentumB > 0.3 && <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />}
                  {phase !== "winner" && momentumB < -0.3 && <TrendingDown className="h-2.5 w-2.5 text-red-400" />}
                  {phase !== "winner" && isNewHighB && <span className="text-[8px] text-yellow-400">★</span>}
                </div>
                <div className={`text-base font-black tabular-nums leading-tight ${
                  cur.retB >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {cur.retB >= 0 ? "+" : ""}{cur.retB.toFixed(1)}%
                </div>
                <div className="text-[9px] text-zinc-600 tabular-nums">{formatKRW(cur.valB)}{locale === "ko" ? "원" : ""}</div>
              </div>
            </div>
          </div>

          {/* 통합 파워 바 (게이지 + 승률 + 격차) */}
          {phase !== "winner" && (
            <PowerBar
              retA={cur.retA}
              retB={cur.retB}
              winProbA={warmedUp ? winProbA : 50}
              gap={gap}
              streak={streak}
              leaderName={leaderIsA ? dataA.name : dataB.name}
              isClose={isClose}
              warmedUp={warmedUp}
              locale={locale}
            />
          )}

          {/* 차트 영역 */}
          <div className="flex-1 px-2 py-1 min-h-0 relative">
            {/* 접전 시 차트 배경 긴장감 */}
            {phase !== "winner" && isClose && (
              <div
                className="absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-700"
                style={{
                  opacity: isVeryClose ? 0.4 : 0.2,
                  background: "radial-gradient(ellipse at center, rgba(239,68,68,0.08) 0%, transparent 70%)",
                }}
              />
            )}

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
                <AreaChart data={chartData} margin={{ top: 8, right: 30, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={leaderIsA ? 0.4 : 0.15} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={!leaderIsA ? 0.4 : 0.15} />
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
                    strokeWidth={leaderIsA ? 2.5 : 1.5}
                    fill="url(#gA)"
                    dot={(props: Record<string, unknown>) => {
                      const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                      if (index !== lastIdx || !cx || !cy) return <g key={`dA${index}`} />;
                      return (
                        <RaceIcon
                          key="endA"
                          cx={cx}
                          cy={cy}
                          color="#10b981"
                          logoUrl={logoUrlA}
                          initial={dataA.name.charAt(0)}
                          clipId="raceClipA"
                          isLeader={leaderIsA}
                        />
                      );
                    }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="retB"
                    stroke="#6366f1"
                    strokeWidth={!leaderIsA ? 2.5 : 1.5}
                    fill="url(#gB)"
                    dot={(props: Record<string, unknown>) => {
                      const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                      if (index !== lastIdx || !cx || !cy) return <g key={`dB${index}`} />;
                      return (
                        <RaceIcon
                          key="endB"
                          cx={cx}
                          cy={cy}
                          color="#6366f1"
                          logoUrl={logoUrlB}
                          initial={dataB.name.charAt(0)}
                          clipId="raceClipB"
                          isLeader={!leaderIsA}
                        />
                      );
                    }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 하단: 해설 + 타임라인 */}
          {phase !== "winner" && (
            <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] space-y-1">
              {/* 실시간 해설 티커 */}
              <div className="text-center min-h-[18px] flex items-center justify-center gap-2">
                {phase === "finish" ? (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[11px] font-bold animate-pulse uppercase tracking-wider">
                    <Zap className="h-3 w-3" />
                    {locale === "ko" ? "막판 스퍼트" : "Final Sprint"}
                  </span>
                ) : isVeryClose ? (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px] font-bold animate-pulse">
                    <Flame className="h-3 w-3" />
                    {commentary}
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 transition-all duration-300">
                    {commentary}
                    {lcSeen > 0 && (
                      <span className="ml-2 text-orange-400 font-medium">
                        ⚡{locale === "ko" ? `역전 ${lcSeen}회` : `${lcSeen}x`}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* 프로그레스 바 */}
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    phase === "finish"
                      ? "bg-gradient-to-r from-orange-500 to-red-500"
                      : isClose
                        ? "bg-gradient-to-r from-zinc-500 to-orange-500"
                        : "bg-zinc-500"
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

// ── 통합 파워 바 (게이지 + 승률 + 격차) ──
function PowerBar({
  retA, retB, winProbA, gap, streak, leaderName, isClose, warmedUp, locale,
}: {
  retA: number; retB: number; winProbA: number; gap: number;
  streak: number; leaderName: string; isClose: boolean;
  warmedUp: boolean; locale: string;
}) {
  const ko = locale === "ko";
  const aWins = retA >= retB;

  return (
    <div className="px-4 py-0.5">
      {/* 파워 바 */}
      <div className="relative h-6 rounded-full overflow-hidden bg-zinc-800/50 flex">
        <div
          className="h-full transition-all duration-500 ease-out flex items-center justify-start pl-2.5"
          style={{
            width: `${winProbA}%`,
            background: aWins
              ? "linear-gradient(90deg, #065f46, #10b981)"
              : "linear-gradient(90deg, #1c1917, #374151)",
          }}
        >
          <span className={`text-[10px] font-bold tabular-nums whitespace-nowrap ${
            aWins ? "text-emerald-200" : "text-zinc-500"
          }`}>
            {winProbA}%
          </span>
        </div>
        <div
          className="h-full transition-all duration-500 ease-out flex items-center justify-end pr-2.5"
          style={{
            width: `${100 - winProbA}%`,
            background: !aWins
              ? "linear-gradient(90deg, #6366f1, #312e81)"
              : "linear-gradient(90deg, #374151, #1c1917)",
          }}
        >
          <span className={`text-[10px] font-bold tabular-nums whitespace-nowrap ${
            !aWins ? "text-indigo-200" : "text-zinc-500"
          }`}>
            {100 - winProbA}%
          </span>
        </div>
        {/* 충돌선 */}
        <div
          className={`absolute top-0 bottom-0 w-0.5 transition-all duration-500 ${
            isClose ? "bg-orange-400/60 shadow-[0_0_8px_rgba(249,115,22,0.5)]" : "bg-white/20"
          }`}
          style={{ left: `${winProbA}%` }}
        />
        {isClose && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-orange-400/40 animate-ping"
            style={{ left: `calc(${winProbA}% - 5px)` }}
          />
        )}
      </div>
      {/* 바 아래 한 줄 요약 */}
      <div className="flex justify-between items-center mt-0.5 text-[9px] tabular-nums text-zinc-600">
        <span>{ko ? "예상 승률" : "Win Prob."}</span>
        <span>
          {warmedUp && gap > 0 && (
            <span className={isClose ? "text-orange-400 font-medium" : ""}>
              {ko ? "격차" : "Gap"} {gap.toFixed(1)}%p
              {streak > 10 && ` · ${streak}${ko ? "일 연속" : "d"}`}
            </span>
          )}
        </span>
        <span>{ko ? "예상 승률" : "Win Prob."}</span>
      </div>
    </div>
  );
}
