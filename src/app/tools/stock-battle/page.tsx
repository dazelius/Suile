import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { StockBattleClient } from "./StockBattleClient";

export const metadata: Metadata = {
  title: "주식 배틀 - Stock Battle",
  description:
    "두 종목을 선택하고 기간을 정해 수익률 대결! 미국·한국 주식 배틀 시뮬레이터. Pick two stocks and battle their returns!",
  keywords: [
    "주식 배틀", "Stock Battle", "주식 비교", "수익률 비교",
    "주식 시뮬레이터", "AAPL vs TSLA", "삼성전자 vs 카카오",
  ],
  openGraph: {
    title: "주식 배틀 - Stock Battle",
    description: "두 종목의 수익률을 대결시켜 보세요! 미국·한국 주식 배틀 시뮬레이터.",
    url: `${siteConfig.url}/tools/stock-battle`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-qr.png", width: 800, height: 800, alt: "주식 배틀" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "주식 배틀 - Stock Battle",
    description: "두 종목의 수익률을 대결시켜 보세요!",
    images: ["/og-qr.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/stock-battle`,
  },
};

export default function StockBattlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <StockBattleClient />
    </Suspense>
  );
}
