"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
  Legend,
} from "recharts";

interface PegDataPoint {
  quarter: string;
  date: string;
  peg: number | null;
  pe: number | null;
  epsGrowth: number | null;
  forward?: boolean;
  peOnly?: boolean;
}

interface TickerData {
  name: string;
  data: PegDataPoint[];
}

interface PegLineChartProps {
  tickers: Record<string, TickerData>;
  locale: string;
}

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

export function PegLineChart({ tickers, locale }: PegLineChartProps) {
  const tickerKeys = Object.keys(tickers);

  // 종목별 PEG 상태 분석
  const tickerMeta: Record<string, { hasPeg: boolean; allNull: boolean; hasForward: boolean }> = {};
  for (const t of tickerKeys) {
    const data = tickers[t].data;
    const pegPoints = data.filter((d) => d.peg != null);
    tickerMeta[t] = {
      hasPeg: pegPoints.length > 0,
      allNull: pegPoints.length === 0 && data.length > 0,
      hasForward: data.some((d) => (d as any).forward),
    };
  }

  // 모든 분기 통합 X축
  const allQuarters = new Set<string>();
  for (const t of tickerKeys) {
    for (const d of tickers[t].data) allQuarters.add(d.quarter);
  }
  const sortedQuarters = Array.from(allQuarters).sort();

  if (sortedQuarters.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        {locale === "ko" ? "표시할 데이터가 없습니다" : "No data available"}
      </div>
    );
  }

  // Y축 범위 계산 (PEG 값 기준)
  let maxPeg = 3;
  for (const t of tickerKeys) {
    for (const d of tickers[t].data) {
      if (d.peg != null && d.peg > maxPeg && d.peg <= 10) maxPeg = d.peg;
    }
  }
  maxPeg = Math.ceil(maxPeg * 1.2);
  if (maxPeg < 3) maxPeg = 3;
  if (maxPeg > 8) maxPeg = 8;

  // PEG null인 종목의 "표시용 값" (차트 상단 영역)
  const ceilingVal = maxPeg - 0.3;

  // 차트 데이터 생성
  const chartData = sortedQuarters.map((q) => {
    const row: Record<string, any> = { quarter: q };
    for (const t of tickerKeys) {
      const point = tickers[t].data.find((d) => d.quarter === q);
      if (!point) {
        row[t] = null;
      } else if (point.peg != null) {
        // 정상 PEG
        row[t] = point.peg;
      } else if (tickerMeta[t].allNull) {
        // PEG 전혀 없는 종목 → ceiling 표시 (차트에 존재감 유지)
        row[t] = ceilingVal;
      } else {
        // 일부 PEG 있는 종목의 null 포인트 → gap
        row[t] = null;
      }
      if (point) {
        row[`${t}_pe`] = point.pe;
        row[`${t}_growth`] = point.epsGrowth;
        row[`${t}_pegReal`] = point.peg; // 실제 PEG (null 포함)
        row[`${t}_forward`] = (point as any).forward || false;
        row[`${t}_peOnly`] = (point as any).peOnly || false;
      }
    }
    return row;
  });

  const formatQuarter = (q: string) => `${q.slice(2, 4)}.${q.slice(4)}`;

  const hasAnyPeOnly = tickerKeys.some((t) => tickerMeta[t].allNull);
  const hasAnyForward = tickerKeys.some((t) => tickerMeta[t].hasForward);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <ReferenceArea y1={0} y2={1} fill="#10b981" fillOpacity={0.06} />

          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={formatQuarter}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={[0, maxPeg]}
            tick={{ fontSize: 10, fill: "#71717a" }}
            width={36}
          />

          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              return (
                <div className="bg-white border rounded-lg shadow-lg p-3 text-xs space-y-1.5 max-w-[260px]">
                  <p className="font-bold text-zinc-800 mb-1">{label}</p>
                  {payload.map((entry: any, idx: number) => {
                    if (entry.value == null) return null;
                    const t = entry.dataKey;
                    const name = tickers[t]?.name || t;
                    const row = entry.payload;
                    const pegReal = row[`${t}_pegReal`];
                    const pe = row[`${t}_pe`];
                    const growth = row[`${t}_growth`];
                    const isForward = row[`${t}_forward`];
                    const isAllNull = tickerMeta[t]?.allNull;

                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: entry.color }}
                        />
                        <div className="leading-tight">
                          <span className="font-semibold">{name}</span>
                          {isAllNull ? (
                            <span className="text-red-500 ml-1">
                              PEG N/A {locale === "ko" ? "(적자)" : "(Loss)"}
                            </span>
                          ) : pegReal != null ? (
                            <span className="ml-1">
                              PEG {pegReal}
                              {isForward && <span className="text-blue-500 text-[9px] ml-0.5">(fwd)</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground ml-1">PEG N/A</span>
                          )}
                          {pe != null && (
                            <span className="text-muted-foreground ml-1">
                              PE {pe > 0 ? pe : `${pe} (적자)`}
                            </span>
                          )}
                          {growth != null && (
                            <span className={`block ${growth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              EPS {locale === "ko" ? "성장률" : "Growth"} {growth >= 0 ? "+" : ""}{growth}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />

          <ReferenceLine
            y={1}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: locale === "ko" ? "적정가 (PEG=1)" : "Fair Value (PEG=1)",
              position: "insideTopRight",
              fill: "#ef4444",
              fontSize: 10,
              fontWeight: 600,
            }}
          />

          {tickerKeys.map((t, idx) => {
            const isNoPeg = tickerMeta[t].allNull;
            const isForwardOnly = tickerMeta[t].hasForward && !tickerMeta[t].hasPeg;
            const isDashed = isNoPeg || isForwardOnly;
            return (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={isDashed ? 1.5 : 2.5}
                strokeDasharray={isDashed ? "6 4" : undefined}
                strokeOpacity={isNoPeg ? 0.5 : 1}
                dot={isNoPeg ? false : { r: 3, fill: COLORS[idx % COLORS.length] }}
                activeDot={{ r: 5 }}
                connectNulls
                name={tickers[t].name + (isNoPeg ? (locale === "ko" ? " (적자)" : " (Loss)") : "")}
              />
            );
          })}

          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => <span className="text-xs font-medium">{value}</span>}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* 해석 가이드 */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
          PEG &lt; 1 {locale === "ko" ? "저평가" : "Under"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-6 h-0.5 rounded" style={{ borderTop: "2px dashed #ef4444", height: 0 }} />
          PEG = 1 {locale === "ko" ? "적정" : "Fair"}
        </span>
        <span>PEG &gt; 1 {locale === "ko" ? "고평가" : "Over"}</span>
      </div>

      {/* 주석 */}
      {(hasAnyPeOnly || hasAnyForward) && (
        <div className="text-[10px] text-center mt-1.5 space-y-0.5">
          {hasAnyPeOnly && (
            <p className="text-amber-600">
              {locale === "ko"
                ? "※ 점선 = 적자/역성장 종목 (PEG 산출 불가, 차트 상단에 참고용 표시)"
                : "※ Dashed = Loss-making/negative growth (PEG N/A, shown at top for reference)"}
            </p>
          )}
          {hasAnyForward && (
            <p className="text-blue-600">
              {locale === "ko"
                ? "※ (fwd) = Yahoo Finance 제공 Forward PEG (애널리스트 추정치 기반)"
                : "※ (fwd) = Forward PEG from Yahoo Finance (based on analyst estimates)"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
