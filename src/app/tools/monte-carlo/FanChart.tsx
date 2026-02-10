"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { PercentileBand } from "./monte-carlo-engine";

interface FanChartProps {
  bands: PercentileBand[];
  investAmount: number;
  lastPrice: number;
  locale: string;
}

function formatAmount(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return Math.round(n).toLocaleString("ko-KR");
}

export function FanChart({ bands, investAmount, lastPrice, locale }: FanChartProps) {
  const shares = investAmount / lastPrice;

  // 차트 데이터: 밴드를 투자금 기준으로 변환
  const chartData = bands
    .filter((_, i) => {
      // 데이터 포인트가 너무 많으면 간격 조절
      if (bands.length > 500) return i % 5 === 0 || i === bands.length - 1;
      if (bands.length > 200) return i % 2 === 0 || i === bands.length - 1;
      return true;
    })
    .map((b) => ({
      date: b.date,
      day: b.day,
      p10: Math.round(shares * b.p10),
      p25: Math.round(shares * b.p25),
      p50: Math.round(shares * b.p50),
      p75: Math.round(shares * b.p75),
      p90: Math.round(shares * b.p90),
    }));

  // Y축 범위 계산
  const allValues = chartData.flatMap((d) => [d.p10, d.p90]);
  const yMin = Math.min(...allValues, investAmount) * 0.85;
  const yMax = Math.max(...allValues, investAmount) * 1.1;

  // X축 라벨: 매 6개월
  const tickDays = new Set<number>();
  const monthInterval = bands.length > 500 ? 6 : 3;
  for (let m = monthInterval; m * 21 < bands.length; m += monthInterval) {
    tickDays.add(m * 21);
  }
  tickDays.add(bands.length); // 마지막

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="mcP90" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="mcP75" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="mcP50" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={formatDate}
            interval="preserveStartEnd"
            minTickGap={60}
          />

          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v: number) => formatAmount(v)}
            width={60}
          />

          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              return (
                <div className="bg-white border rounded-lg shadow-lg p-3 text-xs space-y-1">
                  <p className="font-semibold text-zinc-800">{formatDate(label as string)}</p>
                  <p className="text-emerald-600">P90 (낙관): {formatAmount(d.p90)}원</p>
                  <p className="text-emerald-700">P75: {formatAmount(d.p75)}원</p>
                  <p className="text-zinc-900 font-bold">P50 (중앙): {formatAmount(d.p50)}원</p>
                  <p className="text-orange-600">P25: {formatAmount(d.p25)}원</p>
                  <p className="text-red-500">P10 (비관): {formatAmount(d.p10)}원</p>
                </div>
              );
            }}
          />

          {/* P10-P90 밴드 (가장 넓은 범위) */}
          <Area
            type="monotone"
            dataKey="p90"
            stroke="none"
            fill="url(#mcP90)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="p10"
            stroke="none"
            fill="white"
            fillOpacity={1}
          />

          {/* P25-P75 밴드 */}
          <Area
            type="monotone"
            dataKey="p75"
            stroke="none"
            fill="url(#mcP75)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="p25"
            stroke="none"
            fill="white"
            fillOpacity={1}
          />

          {/* P50 중앙 라인 */}
          <Area
            type="monotone"
            dataKey="p50"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="none"
            dot={false}
          />

          {/* 원금 기준선 */}
          <ReferenceLine
            y={investAmount}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: locale === "ko" ? "원금" : "Initial",
              position: "insideTopRight",
              fill: "#ef4444",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-200/60 border border-emerald-300" />
          P10-P90
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-300/60 border border-emerald-400" />
          P25-P75
        </span>
        <span className="flex items-center gap-1">
          <span className="w-6 h-0.5 bg-emerald-500 rounded" />
          P50 (중앙)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-6 h-0.5 bg-red-400 rounded border-dashed" style={{ borderTop: "2px dashed #ef4444", height: 0 }} />
          {locale === "ko" ? "원금" : "Initial"}
        </span>
      </div>
    </div>
  );
}
