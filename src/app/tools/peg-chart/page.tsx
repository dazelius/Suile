import type { Metadata } from "next";
import { Suspense } from "react";
import { PegChartClient } from "./PegChartClient";

export const metadata: Metadata = {
  title: "PEG 비율 차트 | SUILE",
  description:
    "여러 종목의 분기별 PEG 비율을 한눈에 비교하세요. 성장성 대비 주가가 저평가인지 고평가인지 확인할 수 있습니다.",
  keywords: [
    "PEG 비율",
    "PEG ratio",
    "주식 밸류에이션",
    "분기별 PEG",
    "PE ratio",
    "EPS 성장률",
    "주가 분석",
    "저평가 종목",
  ],
};

export default function PegChartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PegChartClient />
    </Suspense>
  );
}
