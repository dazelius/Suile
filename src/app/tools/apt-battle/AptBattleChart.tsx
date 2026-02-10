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
  // 개별 거래건을 시간순 인터리브 → 최근가 방식으로 양쪽 다 표시
  const events: { date: string; side: "A" | "B"; pp: number; price: number }[] = [];
  for (const p of pricesA) events.push({ date: p.date, side: "A", pp: p.pricePerPyeong, price: p.price });
  for (const p of pricesB) events.push({ date: p.date, side: "B", pp: p.pricePerPyeong, price: p.price });
  events.sort((a, b) => a.date.localeCompare(b.date));

  let lastA: number | null = null, lastB: number | null = null;
  let lastPA: number | null = null, lastPB: number | null = null;
  const chartData = events.map((ev) => {
    if (ev.side === "A") { lastA = ev.pp; lastPA = ev.price; }
    else { lastB = ev.pp; lastPB = ev.price; }
    return {
      date: ev.date,
      a: lastA,
      b: lastB,
      priceA: lastPA,
      priceB: lastPB,
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
            type="stepAfter"
            dataKey="a"
            stroke="#059669"
            fill="#059669"
            fillOpacity={0.08}
            strokeWidth={2}
            connectNulls
            name={nameA}
            dot={{ r: 2, fill: "#059669", strokeWidth: 0 }}
          />
          <Area
            type="stepAfter"
            dataKey="b"
            stroke="#7c3aed"
            fill="#7c3aed"
            fillOpacity={0.08}
            strokeWidth={2}
            connectNulls
            name={nameB}
            dot={{ r: 2, fill: "#7c3aed", strokeWidth: 0 }}
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
