"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface PricePoint {
  date: string;
  price: number;
  pricePerPyeong: number;
}

interface AptBattleChartProps {
  nameA: string;
  nameB: string;
  pricesA: PricePoint[];
  pricesB: PricePoint[];
}

export function AptBattleChart({ nameA, nameB, pricesA, pricesB }: AptBattleChartProps) {
  // 통합 차트 데이터 (날짜 기준 merge)
  const allDates = new Set<string>();
  for (const p of pricesA) allDates.add(p.date);
  for (const p of pricesB) allDates.add(p.date);
  const sortedDates = Array.from(allDates).sort();

  const chartData = sortedDates.map((date) => {
    const a = pricesA.find((p) => p.date === date);
    const b = pricesB.find((p) => p.date === date);
    return {
      date,
      a: a ? a.pricePerPyeong : null,
      b: b ? b.pricePerPyeong : null,
      priceA: a ? a.price : null,
      priceB: b ? b.price : null,
    };
  });

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[0].slice(2)}.${parts[1]}`;
  };

  const formatPyeong = (v: number) => {
    if (v >= 10000) return `${(v / 10000).toFixed(0)}만`;
    return `${Math.round(v / 100) * 100}`;
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={formatDate}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={formatPyeong}
            width={48}
          />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              return (
                <div className="bg-white border rounded-lg shadow-lg p-3 text-xs space-y-1">
                  <p className="font-bold text-zinc-800">{label}</p>
                  {payload.map((entry: any, idx: number) => {
                    if (entry.value == null) return null;
                    const isA = entry.dataKey === "a";
                    const price = isA ? entry.payload.priceA : entry.payload.priceB;
                    const name = isA ? nameA : nameB;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="font-semibold">{name}</span>
                        <span>평당 {Math.round(entry.value).toLocaleString()}만</span>
                        {price && (
                          <span className="text-muted-foreground">
                            ({(price / 10000).toFixed(1)}억)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="a"
            stroke="#059669"
            fill="#059669"
            fillOpacity={0.1}
            strokeWidth={2.5}
            connectNulls
            name={nameA}
          />
          <Area
            type="monotone"
            dataKey="b"
            stroke="#7c3aed"
            fill="#7c3aed"
            fillOpacity={0.1}
            strokeWidth={2.5}
            connectNulls
            name={nameB}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-xs font-medium">{value}</span>
            )}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-center text-muted-foreground mt-1">
        * 평당가 = 매매가 / (전용면적 ÷ 3.3m²), 분기별 평균
      </p>
    </div>
  );
}
