import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import StockRoyaleClient from "./StockRoyaleClient";

export const metadata: Metadata = {
  title: "주식 배틀로얄 - Stock Battle Royale",
  description:
    "AAPL vs TSLA vs 삼성전자 vs NVDA — 누가 시장을 독점할까? 실제 주식 데이터로 구슬을 만들어 부딪히는 실시간 배틀로얄! 시총이 곧 체력, 공매도가 치명타, 배당이 회복력. 최후의 1종목을 가려라!",
  keywords: [
    "주식 배틀로얄", "주식 게임", "stock battle royale", "stock game",
    "배틀로얄", "RPG", "주식 RPG", "stock RPG",
    "시가총액", "배당", "변동성", "투자 게임",
    "AAPL", "TSLA", "삼성전자", "NVDA", "구슬치기",
  ],
  openGraph: {
    title: "주식 배틀로얄 — 8개 종목, 최후의 1종목을 가려라!",
    description:
      "AAPL vs TSLA vs 삼성전자 vs NVDA — 실제 시총·변동성·배당 데이터로 구슬을 만들어 충돌! 공매도, 적대적 인수합병, 시장 패닉까지. 살아남는 건 단 하나.",
    url: `${siteConfig.url}/tools/stock-royale`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-stock-royale.png", width: 1200, height: 630, alt: "주식 배틀로얄" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "주식 배틀로얄 — 8개 종목, 최후의 1종목을 가려라!",
    description:
      "AAPL vs TSLA vs 삼성전자 vs NVDA — 실제 주식 데이터로 실시간 구슬 배틀! 공매도·M&A·시장 패닉. 살아남는 건 단 하나.",
    images: ["/og-stock-royale.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/stock-royale`,
  },
};

export default function StockRoyalePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <StockRoyaleClient />
    </Suspense>
  );
}
