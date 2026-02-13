import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import StockScoreClient from "./StockScoreClient";

export const metadata: Metadata = {
  title: "주식 성적표 - Stock Score & Ranking",
  description:
    "S&P 500 전 종목을 PER, PBR, ROE 등 핵심 지표로 채점! 100점 만점 성적표와 AI 분석, 매수 전 체크리스트까지.",
  keywords: [
    "주식 성적표", "주식 점수", "S&P 500 랭킹", "PER", "PBR",
    "ROE", "주식 평가", "stock score", "stock ranking", "밸류에이션",
  ],
  openGraph: {
    title: "주식 성적표 - S&P 500 투자 점수",
    description: "S&P 500 전 종목을 핵심 지표로 채점! 100점 만점 투자 성적표.",
    url: `${siteConfig.url}/tools/stock-score`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-stock-score.png", width: 1200, height: 630, alt: "주식 성적표" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "주식 성적표 - S&P 500 투자 점수",
    description: "S&P 500 전 종목 자동 채점! 100점 만점 투자 성적표.",
    images: ["/og-stock-score.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/stock-score`,
  },
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
