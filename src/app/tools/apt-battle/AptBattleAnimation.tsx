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
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

interface PricePoint { date: string; price: number; pricePerPyeong: number; floor?: string; }
interface AptData { name: string; area: number; lawdCd: string; prices: PricePoint[]; }
interface Props { dataA: AptData; dataB: AptData; regionA: string; regionB: string; onComplete: () => void; }

function fmtPrice(n: number) {
  if (n >= 10000) { const e = Math.floor(n / 10000), r = Math.round((n % 10000) / 1000); return r > 0 ? `${e}억${r}천` : `${e}억`; }
  return `${n.toLocaleString()}만`;
}
function fmtPP(n: number) { return n >= 10000 ? `${(n / 10000).toFixed(1)}만` : `${Math.round(n).toLocaleString()}`; }

interface TxEvent { side: "A" | "B"; date: string; price: number; pp: number; floor?: string; }
interface ChartRow { idx: number; date: string; retA: number; retB: number; ppA: number; ppB: number; priceA: number; priceB: number; cumA: number; cumB: number; }

function build(a: AptData, b: AptData) {
  const evs: TxEvent[] = [];
  for (const p of a.prices) evs.push({ side: "A", date: p.date, price: p.price, pp: p.pricePerPyeong, floor: p.floor });
  for (const p of b.prices) evs.push({ side: "B", date: p.date, price: p.price, pp: p.pricePerPyeong, floor: p.floor });
  evs.sort((x, y) => x.date.localeCompare(y.date));

  const initA = a.prices[0]?.pricePerPyeong || 1, initB = b.prices[0]?.pricePerPyeong || 1;
  let ppA = initA, ppB = initB, prA = a.prices[0]?.price || 0, prB = b.prices[0]?.price || 0, cA = 0, cB = 0;
  const rows: ChartRow[] = [];
  for (let i = 0; i < evs.length; i++) {
    const ev = evs[i];
    if (ev.side === "A") { ppA = ev.pp; prA = ev.price; cA++; } else { ppB = ev.pp; prB = ev.price; cB++; }
    if (!prA) prA = ev.price; if (!prB) prB = ev.price;
    rows.push({ idx: i, date: ev.date, retA: ((ppA - initA) / initA) * 100, retB: ((ppB - initB) / initB) * 100, ppA, ppB, priceA: prA, priceB: prB, cumA: cA, cumB: cB });
  }
  return { rows, evs };
}

export function AptBattleAnimation({ dataA, dataB, regionA, regionB, onComplete }: Props) {
  const { rows, evs } = useRef(build(dataA, dataB)).current;
  const total = rows.length;

  const [progress, setProgress] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const animRef = useRef(0);

  // 15초 동안 처음부터 끝까지 선형 재생
  useEffect(() => {
    if (total <= 1) { setShowWinner(true); setTimeout(onComplete, 1500); return; }
    const DURATION = 15000; // 15초
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(1, elapsed / DURATION);
      const step = Math.min(total, Math.max(1, Math.ceil(pct * total)));
      setProgress(step);

      if (pct >= 1) {
        setProgress(total);
        setShowWinner(true);
        setTimeout(onComplete, 2500);
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [total, onComplete]);

  const vis = rows.slice(0, Math.max(1, progress));
  const cur = vis[vis.length - 1];
  const retA = cur?.retA ?? 0, retB = cur?.retB ?? 0;
  const cA = cur?.cumA ?? 0, cB = cur?.cumB ?? 0;
  const txTotal = cA + cB || 1;
  const txBarA = Math.max(5, (cA / txTotal) * 100);

  // 현재 시점 년도
  const curDate = cur?.date ?? "";
  const displayDate = curDate ? `${curDate.substring(0, 4)}.${curDate.substring(5, 7)}` : "";

  // 최종 결과
  const lastRow = rows[total - 1];
  const winA = (lastRow?.retA ?? 0) > (lastRow?.retB ?? 0);
  const winB = (lastRow?.retB ?? 0) > (lastRow?.retA ?? 0);
  const winnerName = winA ? dataA.name : winB ? dataB.name : "";

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* 프로그레스 */}
      <div className="h-0.5 bg-zinc-800">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all duration-75" style={{ width: `${(progress / total) * 100}%` }} />
      </div>

      {/* 상단: 이름 + 수익률 */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-base shrink-0">
            {dataA.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-white text-[11px] font-bold truncate">{dataA.name}</p>
            <p className={`text-sm font-black ${retA >= 0 ? "text-red-400" : "text-blue-400"}`}>
              {retA >= 0 ? "+" : ""}{retA.toFixed(1)}%
            </p>
          </div>
        </div>
        {/* 시간 */}
        <div className="text-center shrink-0 px-2">
          <p className="text-zinc-400 text-lg font-mono font-bold tabular-nums">{displayDate}</p>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-white text-[11px] font-bold truncate">{dataB.name}</p>
            <p className={`text-sm font-black ${retB >= 0 ? "text-red-400" : "text-blue-400"}`}>
              {retB >= 0 ? "+" : ""}{retB.toFixed(1)}%
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-base shrink-0">
            {dataB.name.charAt(0)}
          </div>
        </div>
      </div>

      {/* 거래량 바 */}
      <div className="px-3 space-y-0.5">
        <div className="flex justify-between text-[9px] text-zinc-500 px-0.5">
          <span>{cA}건</span>
          <span className="text-zinc-600">거래량</span>
          <span>{cB}건</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-zinc-800/50 flex">
          <div className="h-full bg-emerald-600/70 transition-all duration-150 ease-out" style={{ width: `${txBarA}%` }} />
          <div className="flex-1 h-full bg-violet-600/70 transition-all duration-150 ease-out" />
        </div>
      </div>

      {/* 차트 */}
      <div className="flex-1 px-1 pt-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={vis} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 4" />
            <Area type="stepAfter" dataKey="retA" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
            <Area type="stepAfter" dataKey="retB" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 하단: 평당가 + 매매가 */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1">
        <div className="bg-zinc-900/80 rounded-xl p-2 border border-emerald-900/20">
          <p className="text-[9px] text-emerald-400/70 font-medium">평당가</p>
          <p className="text-white text-base font-black">{fmtPP(cur?.ppA ?? 0)}<span className="text-[9px] text-zinc-600">만</span></p>
          <p className="text-zinc-600 text-[9px]">매매 {fmtPrice(cur?.priceA ?? 0)}</p>
        </div>
        <div className="bg-zinc-900/80 rounded-xl p-2 border border-violet-900/20">
          <p className="text-[9px] text-violet-400/70 font-medium">평당가</p>
          <p className="text-white text-base font-black">{fmtPP(cur?.ppB ?? 0)}<span className="text-[9px] text-zinc-600">만</span></p>
          <p className="text-zinc-600 text-[9px]">매매 {fmtPrice(cur?.priceB ?? 0)}</p>
        </div>
      </div>

      {/* 승자 오버레이 */}
      {showWinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 animate-in fade-in-0 duration-500">
          <div className="text-center space-y-4 px-6">
            <Trophy className="h-12 w-12 text-yellow-400 mx-auto animate-bounce" />
            <p className="text-white text-xl font-black">
              {winnerName ? `${winnerName} 승리!` : "무승부!"}
            </p>
            <div className="flex items-end justify-center gap-5">
              <div className="text-center">
                <p className="text-emerald-400 text-[11px] font-bold mb-1">{dataA.name}</p>
                <p className={`text-2xl font-black ${(lastRow?.retA ?? 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {(lastRow?.retA ?? 0) >= 0 ? "+" : ""}{(lastRow?.retA ?? 0).toFixed(1)}%
                </p>
                <p className="text-zinc-500 text-[10px] mt-0.5">{fmtPrice(lastRow?.priceA ?? 0)}</p>
                <p className="text-zinc-600 text-[9px]">{lastRow?.cumA ?? 0}건 거래</p>
              </div>
              <p className="text-zinc-600 text-lg font-bold pb-3">vs</p>
              <div className="text-center">
                <p className="text-violet-400 text-[11px] font-bold mb-1">{dataB.name}</p>
                <p className={`text-2xl font-black ${(lastRow?.retB ?? 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {(lastRow?.retB ?? 0) >= 0 ? "+" : ""}{(lastRow?.retB ?? 0).toFixed(1)}%
                </p>
                <p className="text-zinc-500 text-[10px] mt-0.5">{fmtPrice(lastRow?.priceB ?? 0)}</p>
                <p className="text-zinc-600 text-[9px]">{lastRow?.cumB ?? 0}건 거래</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
