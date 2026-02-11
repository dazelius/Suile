import type { Metadata } from "next";
import { Suspense } from "react";
import StockScoreClient from "./StockScoreClient";

export const metadata: Metadata = {
  title: "주식 성적표 - S&P 500 투자 점수 랭킹 | SUILE",
  description:
    "S&P 500 전 종목을 PER, PBR, ROE 등 핵심 지표로 채점! 100점 만점 성적표와 전체 랭킹을 확인하세요.",
  keywords: [
    "주식 성적표",
    "주식 점수",
    "S&P 500 랭킹",
    "PER",
    "PBR",
    "ROE",
    "주식 평가",
    "stock score",
    "stock ranking",
    "투자 점수",
    "밸류에이션",
  ],
};

export default function StockScorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <StockScoreClient />
    </Suspense>
  );
}
