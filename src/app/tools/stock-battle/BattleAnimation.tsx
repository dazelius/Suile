"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { playBeep, playCrash, playReversal, playFanfare } from "./sfx";

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
  isSprinting,
  value,
}: {
  cx: number;
  cy: number;
  color: string;
  logoUrl: string;
  initial: string;
  clipId: string;
  isLeader: boolean;
  isSprinting: boolean;
  value: number;
}) {
  const R = 17;

  return (
    <g>
      {/* ── 외곽 글로우 ── */}
      <circle
        cx={cx} cy={cy} r={R + 3}
        fill="none"
        stroke={color}
        strokeWidth={isLeader ? 1.8 : 1}
        opacity={isLeader ? 0.3 : 0.12}
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
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="central"
          fontSize={R * 0.75} fontWeight="bold" fill={color}
        >
          {initial}
        </text>
      )}

      {/* ── 수익률 % 레이블 ── */}
      <text
        x={cx}
        y={cy - R - 5}
        textAnchor="middle"
        fontSize={9}
        fontWeight="bold"
        fill={value >= 0 ? "#6ee7b7" : "#fca5a5"}
      >
        {value >= 0 ? "+" : ""}{value.toFixed(1)}%
      </text>
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

  // ── 연속 우세 카운트 (최대 30개만 역추적) ──
  let streak = 0;
  {
    const end = Math.min(visibleCount - 1, total - 1);
    const start = Math.max(0, end - 30);
    for (let i = end; i >= start; i--) {
      if ((allData.current[i].retA >= allData.current[i].retB) === leaderIsA) streak++;
      else break;
    }
  }

  // ── 최고 수익률 (증분 계산) ──
  const peakRef = useRef({ a: -Infinity, b: -Infinity, idx: 0 });
  {
    const pr = peakRef.current;
    for (let i = pr.idx; i < visibleCount && i < total; i++) {
      if (allData.current[i].retA > pr.a) pr.a = allData.current[i].retA;
      if (allData.current[i].retB > pr.b) pr.b = allData.current[i].retB;
    }
    pr.idx = Math.min(visibleCount, total);
  }
  const peakA = peakRef.current.a, peakB = peakRef.current.b;
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
    playBeep(countdown === 1);
    const t = setTimeout(() => setCountdown((c) => c - 1), 750);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // ── Racing animation (한 단계, 일정 속도) ──
  useEffect(() => {
    if (phase !== "racing") return;

    const RACE_MS = 25000;

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / RACE_MS, 1);
      // ease-in-out: 초반 살짝 가속 → 일정 → 끝까지
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const target = Math.max(1, Math.floor(eased * total));
      setVisibleCount(target);
      if (elapsed >= RACE_MS) {
        setVisibleCount(total);
        setPhase("winner");
        return;
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, total]);

  // ── Lead change detection (역전 감지 + 충돌 파티클) ──
  const iconPosRef = useRef({ ax: 0, ay: 0, bx: 0, by: 0 });
  const [crashes, setCrashes] = useState<{ id: number; x: number; y: number }[]>([]);
  const allCrashCount = useRef(0); // 누적 교차 횟수 (초반 포함)

  useEffect(() => {
    // 모든 교차에서 충돌 파티클 (초반 제한 없음)
    const allSeen = leadChanges.current.filter((lc) => lc.index <= visibleCount - 1);
    if (allSeen.length > allCrashCount.current) {
      const pos = iconPosRef.current;
      const midX = (pos.ax + pos.bx) / 2;
      const midY = (pos.ay + pos.by) / 2;
      // 새로운 교차 수만큼 파티클 추가
      const newCrashes: { id: number; x: number; y: number }[] = [];
      for (let i = allCrashCount.current; i < allSeen.length; i++) {
        newCrashes.push({ id: Date.now() + i, x: midX, y: midY });
      }
      allCrashCount.current = allSeen.length;
      playCrash();
      setCrashes(prev => [...prev, ...newCrashes]);
      // 0.5초 후 해당 파티클들 제거
      const ids = newCrashes.map(c => c.id);
      setTimeout(() => {
        setCrashes(prev => prev.filter(c => !ids.includes(c.id)));
      }, 500);
    }

    // 역전 뱃지/리더 플래시는 초반 20% 이후만
    const minIdx = Math.floor(total * 0.2);
    const seen = allSeen.filter((lc) => lc.index >= minIdx);
    if (seen.length > lcSeen) {
      const latest = seen[seen.length - 1];
      setLeadFlash(latest.newLeader);
      setReversalOverlay({ leader: latest.newLeader, count: seen.length });
      setLcSeen(seen.length);
      playReversal();
      setTimeout(() => setLeadFlash(null), 1000);
      setTimeout(() => setReversalOverlay(null), 1200);
    }
  }, [visibleCount, lcSeen, total]);

  // ── Winner → onComplete ──
  useEffect(() => {
    if (phase !== "winner") return;
    playFanfare();
    const t = setTimeout(onComplete, 3500);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  // ── 슬라이딩 윈도우 + 룩어헤드 ──
  const WINDOW = Math.min(120, Math.max(80, Math.floor(total * 0.45)));
  const targetStart = Math.max(0, visibleCount - WINDOW);

  // 부드러운 스크롤
  const windowStartRef = useRef(0);
  windowStartRef.current += (targetStart - windowStartRef.current) * 0.18;
  const windowStart = Math.max(0, Math.round(windowStartRef.current));

  const realData = allData.current.slice(windowStart, visibleCount);
  const lastRealIdx = realData.length - 1;

  // 룩어헤드
  const baseLookAhead = Math.floor(WINDOW * 0.22);
  const lookAhead = Math.min(baseLookAhead, total - visibleCount);

  const chartData = useMemo(() => {
    if (lookAhead === 0) return realData;
    const pad: ChartRow[] = [];
    for (let i = 0; i < lookAhead; i++) {
      const fi = Math.min(visibleCount + i, total - 1);
      pad.push({
        idx: visibleCount + i,
        date: allData.current[fi].date,
        retA: null as unknown as number,
        retB: null as unknown as number,
        valA: 0,
        valB: 0,
      });
    }
    return [...realData, ...pad];
  }, [windowStart, visibleCount, lookAhead]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = Math.round((visibleCount / total) * 100);
  const lastIdx = lastRealIdx;

  // ── 안정적 Y축 도메인 (텔레포트 방지) ──
  const yDomainRef = useRef<[number, number]>([-5, 5]);
  const MIN_Y_RANGE = 4;
  {
    let cMin = 0, cMax = 0;
    for (const d of realData) {
      if (d.retA < cMin) cMin = d.retA;
      if (d.retB < cMin) cMin = d.retB;
      if (d.retA > cMax) cMax = d.retA;
      if (d.retB > cMax) cMax = d.retB;
    }
    const pad = Math.max(MIN_Y_RANGE, (cMax - cMin) * 0.15);
    const tMin = cMin - pad;
    const tMax = cMax + pad;
    yDomainRef.current = [
      yDomainRef.current[0] + (tMin - yDomainRef.current[0]) * 0.14,
      yDomainRef.current[1] + (tMax - yDomainRef.current[1]) * 0.14,
    ];
    const range = yDomainRef.current[1] - yDomainRef.current[0];
    if (range < MIN_Y_RANGE * 2) {
      const mid = (yDomainRef.current[0] + yDomainRef.current[1]) / 2;
      yDomainRef.current = [mid - MIN_Y_RANGE, mid + MIN_Y_RANGE];
    }
  }

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

      {/* ── 역전 미니 뱃지 (차트 줌인이 메인 효과) ── */}
      {reversalOverlay && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in zoom-in-90 duration-200">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm"
            style={{
              backgroundColor: reversalOverlay.leader === "A" ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.2)",
              color: reversalOverlay.leader === "A" ? "#6ee7b7" : "#a5b4fc",
              border: `1px solid ${reversalOverlay.leader === "A" ? "rgba(16,185,129,0.3)" : "rgba(99,102,241,0.3)"}`,
            }}
          >
            {locale === "ko" ? "역전" : "Lead Change"}
            {reversalOverlay.count > 1 && ` ${reversalOverlay.count}x`}
          </span>
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
              ) : isVeryClose ? (
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
          <div className="flex-1 px-2 py-1 min-h-0 relative overflow-hidden">
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

            {/* 왼쪽 모션 블러 */}
            {phase !== "winner" && visibleCount > WINDOW && (
              <div
                className="absolute inset-y-0 left-0 w-20 pointer-events-none z-10 rounded-l-lg"
                style={{ background: "linear-gradient(to right, #0a0a0b 10%, transparent)" }}
              />
            )}

            {/* 골인 라인 (오른쪽 끝 — 체커 플래그 스트라이프) */}
            {phase === "racing" && progressRatio > 0.5 && (
              <div
                className="absolute inset-y-0 right-0 pointer-events-none z-10 flex flex-col justify-between"
                style={{
                  width: 6,
                  opacity: Math.min(1, (progressRatio - 0.5) * 3),
                }}
              >
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      background: i % 2 === 0
                        ? "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)"
                        : "linear-gradient(90deg, transparent 0%, rgba(250,204,21,0.5) 50%, transparent 100%)",
                    }}
                  />
                ))}
              </div>
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
                      <stop offset="0%" stopColor="#10b981" stopOpacity={leaderIsA ? 0.35 : 0.12} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={!leaderIsA ? 0.35 : 0.12} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={yDomainRef.current} />
                  <ReferenceLine y={0} stroke="#27272a" strokeWidth={1} strokeDasharray="4 4" />
                  <Area
                    type="monotoneX"
                    dataKey="retA"
                    stroke="#10b981"
                    strokeWidth={leaderIsA ? 2.2 : 1.4}
                    strokeLinecap="round"
                    fill="url(#gA)"
                    connectNulls={false}
                    dot={(props: Record<string, unknown>) => {
                      const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                      if (index !== lastIdx || !cx || !cy) return <g key={`dA${index}`} />;
                      iconPosRef.current.ax = cx;
                      iconPosRef.current.ay = cy;
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
                          isSprinting={false}
                          value={cur.retA}
                        />
                      );
                    }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotoneX"
                    dataKey="retB"
                    stroke="#6366f1"
                    strokeWidth={!leaderIsA ? 2.2 : 1.4}
                    strokeLinecap="round"
                    fill="url(#gB)"
                    connectNulls={false}
                    dot={(props: Record<string, unknown>) => {
                      const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                      if (index !== lastIdx || !cx || !cy) return <g key={`dB${index}`} />;
                      iconPosRef.current.bx = cx;
                      iconPosRef.current.by = cy;
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
                          isSprinting={false}
                          value={cur.retB}
                        />
                      );
                    }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* ── 충돌 파티클 (교차 지점마다, 동시 다수 가능) ── */}
            {crashes.map((c) => (
              <div
                key={c.id}
                className="absolute pointer-events-none z-20"
                style={{ left: c.x, top: c.y, transform: "translate(-50%, -50%)" }}
              >
                {/* 플래시 */}
                <div style={{
                  position: "absolute", left: -60, top: -60, width: 120, height: 120,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(147,197,253,0.6) 0%, transparent 60%)",
                  animation: "crash-flash 0.25s ease-out forwards",
                }} />
                {/* 링 */}
                <div style={{
                  position: "absolute", left: -4, top: -4, width: 8, height: 8,
                  borderRadius: "50%",
                  border: "2px solid #93c5fd",
                  animation: "crash-ring 0.3s ease-out forwards",
                }} />
                {/* 유리 파편 (10개 — 빠르게 팡!) */}
                {Array.from({ length: 10 }, (_, i) => {
                  const deg = i * 36 + (i % 2) * 18;
                  const w = 1.5 + (i % 3) * 1.5;
                  const h = 3 + (i % 4) * 2;
                  return (
                    <div key={`s${i}`} style={{
                      position: "absolute", left: -w / 2, top: -h / 2, width: w, height: h,
                      background: i % 3 === 0 ? "#dbeafe" : i % 3 === 1 ? "#93c5fd" : "#60a5fa",
                      borderRadius: "1px",
                      animation: "crash-shard 0.3s cubic-bezier(0,0.7,0.3,1) forwards",
                      ["--s-deg" as string]: `${deg}deg`,
                      ["--s-dist" as string]: `${-35 - (i % 3) * 15}px`,
                    }} />
                  );
                })}
                {/* 작은 스파크 점 (8개) */}
                {Array.from({ length: 8 }, (_, i) => {
                  const deg = i * 45 + 22;
                  return (
                    <div key={`sp${i}`} style={{
                      position: "absolute", left: -1.5, top: -1.5, width: 3, height: 3,
                      borderRadius: "50%",
                      background: i % 2 === 0 ? "#e0f2fe" : "#bae6fd",
                      animation: "crash-spark 0.35s ease-out forwards",
                      animationDelay: `${i * 0.01}s`,
                      ["--sp-deg" as string]: `${deg}deg`,
                      ["--sp-dist" as string]: `${-50 - (i % 3) * 10}px`,
                    }} />
                  );
                })}
              </div>
            ))}
          </div>

          {/* 하단: 해설 + 타임라인 */}
          {phase !== "winner" && (
            <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] space-y-1">
              {/* 실시간 해설 티커 */}
              <div className="text-center min-h-[18px] flex items-center justify-center gap-2">
                {isVeryClose ? (
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
                    isClose
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
