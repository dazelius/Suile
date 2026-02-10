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

interface PricePoint {
  date: string;
  price: number;
  pricePerPyeong: number;
}
interface AptData {
  name: string;
  area: number;
  lawdCd: string;
  prices: PricePoint[];
}

interface AptBattleAnimationProps {
  dataA: AptData;
  dataB: AptData;
  regionA: string; // 서울 강남구
  regionB: string;
  onComplete: () => void;
}

function formatManwon(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return `${n.toLocaleString()}`;
}

interface ChartRow {
  idx: number;
  retA: number;
  retB: number;
  ppA: number;
  ppB: number;
  date: string;
}

function buildData(a: AptData, b: AptData): ChartRow[] {
  const mapA = new Map(a.prices.map((p) => [p.date, p.pricePerPyeong]));
  const mapB = new Map(b.prices.map((p) => [p.date, p.pricePerPyeong]));
  const dates = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();
  if (dates.length === 0) return [];
  
  const s1 = a.prices[0]?.pricePerPyeong || 1;
  const s2 = b.prices[0]?.pricePerPyeong || 1;
  let la = s1, lb = s2;

  return dates.map((date, idx) => {
    const ca = mapA.get(date) ?? la;
    const cb = mapB.get(date) ?? lb;
    la = ca;
    lb = cb;
    return {
      idx,
      date,
      retA: ((ca - s1) / s1) * 100,
      retB: ((cb - s2) / s2) * 100,
      ppA: ca,
      ppB: cb,
    };
  });
}

const MESSAGES_LEAD = [
  "{name}이(가) 앞서갑니다!",
  "{name} 쾌속 상승 중!",
  "{name} 압도적 리드!",
  "{name}, 부동산 최강자?!",
];
const MESSAGES_CLOSE = [
  "초박빙 승부! 역전 가능!",
  "엎치락뒤치락! 팽팽한 대결!",
  "0.1%p 차이! 숨 막히는 접전!",
];
const MESSAGES_REVERSE = [
  "🔥 역전이다! {name}이(가) 치고 올라옵니다!",
  "💥 반전! {name}이(가) 역전 성공!",
];

export function AptBattleAnimation({
  dataA,
  dataB,
  regionA,
  regionB,
  onComplete,
}: AptBattleAnimationProps) {
  const allRows = useRef(buildData(dataA, dataB));
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("🏠 배틀 시작!");
  const [showWinner, setShowWinner] = useState(false);
  const prevLeader = useRef<"A" | "B" | null>(null);
  const animRef = useRef<number>(0);

  const total = allRows.current.length;
  const visibleData = allRows.current.slice(0, Math.max(1, progress));
  const current = visibleData[visibleData.length - 1];

  const advanceMessage = useCallback(
    (row: ChartRow) => {
      const diff = Math.abs(row.retA - row.retB);
      const leader: "A" | "B" = row.retA >= row.retB ? "A" : "B";
      const leaderName = leader === "A" ? dataA.name : dataB.name;

      if (prevLeader.current && prevLeader.current !== leader) {
        const msgs = MESSAGES_REVERSE;
        setMessage(
          msgs[Math.floor(Math.random() * msgs.length)].replace("{name}", leaderName)
        );
      } else if (diff < 2) {
        const msgs = MESSAGES_CLOSE;
        setMessage(msgs[Math.floor(Math.random() * msgs.length)]);
      } else {
        const msgs = MESSAGES_LEAD;
        setMessage(
          msgs[Math.floor(Math.random() * msgs.length)].replace("{name}", leaderName)
        );
      }
      prevLeader.current = leader;
    },
    [dataA.name, dataB.name]
  );

  useEffect(() => {
    if (total <= 1) {
      setShowWinner(true);
      setTimeout(onComplete, 1000);
      return;
    }

    let frame = 0;
    const TOTAL_FRAMES = 200; // ~6.5초
    const framesToStep = TOTAL_FRAMES / total;
    let msgFrame = 0;

    const tick = () => {
      frame++;
      const step = Math.min(total, Math.ceil(frame / framesToStep));
      setProgress(step);

      // 메시지 업데이트 (약 1.5초 간격)
      if (frame - msgFrame > 45 && step < total) {
        msgFrame = frame;
        advanceMessage(allRows.current[step - 1]);
      }

      if (step >= total) {
        const last = allRows.current[total - 1];
        const winnerName = last.retA > last.retB ? dataA.name : last.retB > last.retA ? dataB.name : "무승부";
        setMessage(`🏆 ${winnerName === "무승부" ? "무승부!" : `${winnerName} 승리!`}`);
        setShowWinner(true);
        setTimeout(onComplete, 2000);
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [total, advanceMessage, onComplete, dataA.name, dataB.name]);

  const retA = current?.retA ?? 0;
  const retB = current?.retB ?? 0;
  const total100 = Math.abs(retA) + Math.abs(retB) || 1;
  const barA = (Math.abs(retA) / total100) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in-0 duration-300">
      {/* 상단: 선수 정보 */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-3 pt-3 pb-1">
        {/* A */}
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
            {dataA.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-bold truncate">{dataA.name}</p>
            <p className="text-emerald-400 text-[10px] truncate">{regionA}</p>
          </div>
        </div>
        {/* VS */}
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-yellow-400" />
        </div>
        {/* B */}
        <div className="flex items-center gap-2 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-white text-xs font-bold truncate">{dataB.name}</p>
            <p className="text-violet-400 text-[10px] truncate">{regionB}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-lg">
            {dataB.name.charAt(0)}
          </div>
        </div>
      </div>

      {/* 실황 메시지 */}
      <div className="px-4 py-1.5 text-center">
        <p className="text-white/90 text-xs font-medium min-h-[18px]">{message}</p>
      </div>

      {/* 수익률 바 */}
      <div className="mx-3 h-7 rounded-full overflow-hidden bg-zinc-800 flex">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center justify-end px-2 transition-all duration-300 ease-out"
          style={{ width: `${Math.max(barA, 8)}%` }}
        >
          <span className="text-white text-[10px] font-bold whitespace-nowrap">
            {retA >= 0 ? "+" : ""}{retA.toFixed(1)}%
          </span>
        </div>
        <div className="flex-1 h-full bg-gradient-to-r from-violet-500 to-violet-600 flex items-center px-2 transition-all duration-300 ease-out">
          <span className="text-white text-[10px] font-bold whitespace-nowrap">
            {retB >= 0 ? "+" : ""}{retB.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 차트 */}
      <div className="flex-1 px-1 pt-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData} margin={{ top: 8, right: 4, bottom: 4, left: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="retA"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="retB"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 하단: 현재 평당가 */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-1">
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-emerald-900/30">
          <p className="text-[10px] text-emerald-400 mb-0.5">평당가</p>
          <p className="text-white text-sm font-bold">{formatManwon(current?.ppA ?? 0)}원</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-2.5 text-center border border-violet-900/30">
          <p className="text-[10px] text-violet-400 mb-0.5">평당가</p>
          <p className="text-white text-sm font-bold">{formatManwon(current?.ppB ?? 0)}원</p>
        </div>
      </div>

      {/* 승자 오버레이 */}
      {showWinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 animate-in fade-in-0 duration-500">
          <div className="text-center space-y-2">
            <Trophy className="h-12 w-12 text-yellow-400 mx-auto animate-bounce" />
            <p className="text-white text-2xl font-black">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
