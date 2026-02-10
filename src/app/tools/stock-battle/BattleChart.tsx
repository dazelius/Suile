"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";

interface PricePoint {
  date: string;
  close: number;
}

interface StockResult {
  ticker: string;
  name: string;
  prices: PricePoint[];
}

interface BattleChartProps {
  dataA: StockResult;
  dataB: StockResult;
  investAmount: number;
}

/** 날짜 기준 정렬 & 수익률 계산 */
function buildChartData(dataA: StockResult, dataB: StockResult, investAmount: number) {
  // 날짜 → 종가 맵
  const mapA = new Map(dataA.prices.map((p) => [p.date, p.close]));
  const mapB = new Map(dataB.prices.map((p) => [p.date, p.close]));

  // 공통 날짜
  const allDates = new Set([...mapA.keys(), ...mapB.keys()]);
  const sortedDates = [...allDates].sort();

  const startA = dataA.prices[0]?.close || 1;
  const startB = dataB.prices[0]?.close || 1;

  let lastA = startA;
  let lastB = startB;

  return sortedDates.map((date) => {
    const closeA = mapA.get(date) ?? lastA;
    const closeB = mapB.get(date) ?? lastB;
    lastA = closeA;
    lastB = closeB;

    const retA = ((closeA - startA) / startA) * 100;
    const retB = ((closeB - startB) / startB) * 100;
    const valA = investAmount * (closeA / startA);
    const valB = investAmount * (closeB / startB);

    return {
      date,
      shortDate: date.slice(2), // "22-01-15"
      [`${dataA.name} (%)`]: Math.round(retA * 10) / 10,
      [`${dataB.name} (%)`]: Math.round(retB * 10) / 10,
      valA: Math.round(valA),
      valB: Math.round(valB),
    };
  });
}

function formatKRWShort(n: number): string {
  if (Math.abs(n) >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (Math.abs(n) >= 1_0000) return `${(n / 1_0000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

export function BattleChart({ dataA, dataB, investAmount }: BattleChartProps) {
  const { locale } = useI18n();
  const chartData = buildChartData(dataA, dataB, investAmount);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {locale === "ko" ? "차트 데이터가 없습니다." : "No chart data available."}
      </div>
    );
  }

  const keyA = `${dataA.name} (%)`;
  const keyB = `${dataB.name} (%)`;

  // 매 N번째만 tick 표시 (데이터가 많으면)
  const interval = Math.max(1, Math.floor(chartData.length / 6));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-center">
        {locale === "ko" ? "수익률 추이" : "Return Comparison"}
      </h3>

      <div className="w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="shortDate"
              interval={interval}
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={{ stroke: "#d4d4d8" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={{ stroke: "#d4d4d8" }}
              tickFormatter={(v) => `${v}%`}
              width={45}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,.08)",
              }}
              labelFormatter={(label) => `20${label}`}
              formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="plainline"
            />
            <Line
              type="monotone"
              dataKey={keyA}
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey={keyB}
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 0% 기준선 설명 */}
      <p className="text-center text-[11px] text-muted-foreground">
        {locale === "ko"
          ? "0%가 투자 시작 시점입니다. 양수면 수익, 음수면 손실."
          : "0% is the starting point. Positive = profit, Negative = loss."}
      </p>
    </div>
  );
}
