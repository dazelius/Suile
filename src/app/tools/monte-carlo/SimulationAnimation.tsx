"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, Loader2 } from "lucide-react";

interface SimulationAnimationProps {
  samplePaths: number[][]; // 20개 샘플 경로
  lastPrice: number;
  investAmount: number;
  onComplete: () => void;
  stockName: string;
}

function formatAmount(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return Math.round(n).toLocaleString("ko-KR");
}

export function SimulationAnimation({
  samplePaths,
  lastPrice,
  investAmount,
  onComplete,
  stockName,
}: SimulationAnimationProps) {
  const [phase, setPhase] = useState<"counting" | "drawing" | "done">("counting");
  const [count, setCount] = useState(3);
  const [drawnPaths, setDrawnPaths] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // 카운트다운
  useEffect(() => {
    if (phase !== "counting") return;
    if (count <= 0) {
      setPhase("drawing");
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(timer);
  }, [phase, count]);

  // 캔버스에 경로 그리기
  const drawPaths = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || samplePaths.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const pathLen = samplePaths[0].length;

    // 전체 범위 계산
    let minP = lastPrice, maxP = lastPrice;
    for (const path of samplePaths) {
      for (const p of path) {
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
      }
    }
    const padding = (maxP - minP) * 0.1;
    minP -= padding;
    maxP += padding;

    const toX = (i: number) => (i / (pathLen - 1)) * W;
    const toY = (p: number) => H - ((p - minP) / (maxP - minP)) * H;

    let step = 0;
    const totalSteps = pathLen;
    const stepsPerFrame = Math.max(1, Math.floor(pathLen / 120)); // ~2초에 그리기

    const animate = () => {
      step += stepsPerFrame;
      if (step > totalSteps) step = totalSteps;

      ctx.clearRect(0, 0, W, H);

      // 배경 그리드
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += H / 5) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // 원금 기준선
      const baseY = toY(lastPrice);
      ctx.strokeStyle = "rgba(239,68,68,0.4)";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      ctx.lineTo(W, baseY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 경로 그리기
      const colors = [
        "rgba(52,211,153,0.35)",
        "rgba(96,165,250,0.35)",
        "rgba(251,191,36,0.35)",
        "rgba(167,139,250,0.35)",
        "rgba(251,113,133,0.35)",
      ];

      for (let pi = 0; pi < samplePaths.length; pi++) {
        const path = samplePaths[pi];
        ctx.strokeStyle = colors[pi % colors.length];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(path[0]));
        for (let i = 1; i < Math.min(step, pathLen); i++) {
          ctx.lineTo(toX(i), toY(path[i]));
        }
        ctx.stroke();
      }

      setCurrentStep(step);
      setDrawnPaths(Math.min(samplePaths.length, Math.ceil((step / totalSteps) * samplePaths.length)));

      if (step < totalSteps) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // 완료 후 잠시 대기
        setTimeout(() => {
          setPhase("done");
          onComplete();
        }, 800);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [samplePaths, lastPrice, onComplete]);

  useEffect(() => {
    if (phase === "drawing") {
      const cleanup = drawPaths();
      return cleanup;
    }
  }, [phase, drawPaths]);

  const shares = investAmount / lastPrice;
  const progressPct = samplePaths[0]
    ? Math.min(100, Math.round((currentStep / samplePaths[0].length) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-bold text-white">Monte Carlo Simulation</span>
        </div>
        <span className="text-xs text-zinc-400">{stockName}</span>
      </div>

      {/* 카운트다운 */}
      {phase === "counting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-6xl font-black text-emerald-400 animate-pulse">
            {count > 0 ? count : "GO"}
          </div>
          <p className="text-sm text-zinc-400">2,000개 시뮬레이션 경로 생성 중...</p>
        </div>
      )}

      {/* 캔버스 그리기 */}
      {phase === "drawing" && (
        <div className="flex-1 flex flex-col px-3 py-2">
          {/* 정보 표시 */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-zinc-400">
              <span className="text-emerald-400 font-mono font-bold">{drawnPaths}</span> / {samplePaths.length} 경로
            </div>
            <div className="text-xs text-zinc-400">
              투자금: <span className="text-white font-semibold">{formatAmount(investAmount)}원</span>
            </div>
          </div>

          {/* 캔버스 */}
          <div className="flex-1 relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50">
            <canvas
              ref={canvasRef}
              width={600}
              height={350}
              className="w-full h-full"
            />
          </div>

          {/* 프로그레스 바 */}
          <div className="mt-3">
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-100 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-zinc-500">시작</span>
              <span className="text-[10px] text-zinc-500">{progressPct}%</span>
              <span className="text-[10px] text-zinc-500">완료</span>
            </div>
          </div>
        </div>
      )}

      {/* 완료 */}
      {phase === "done" && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
