import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import StockRoyaleClient from "./StockRoyaleClient";

export const metadata: Metadata = {
  title: "주식 배틀로얄 - Stock Battle Royale",
  description:
    "주식 데이터를 RPG 스탯으로 변환! 8개 종목이 최후의 1인이 될 때까지 싸우는 배틀로얄 게임. 시가총액은 체력, 변동성은 치명타, 배당은 흡혈!",
  keywords: [
    "주식 배틀로얄", "주식 게임", "stock battle royale", "stock game",
    "배틀로얄", "RPG", "주식 RPG", "stock RPG",
    "시가총액", "배당", "변동성", "투자 게임",
  ],
  openGraph: {
    title: "주식 배틀로얄 - 8개 종목의 생존 대결",
    description:
      "주식 데이터를 RPG 스탯으로 변환! 시가총액=HP, 변동성=치명타, 배당=흡혈. 최후의 1종목을 가려라!",
    url: `${siteConfig.url}/tools/stock-royale`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-qr.png", width: 800, height: 800, alt: "주식 배틀로얄" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "주식 배틀로얄 - 8개 종목의 생존 대결",
    description:
      "주식 데이터를 RPG 스탯으로 변환! 최후의 1종목을 가려라!",
    images: ["/og-qr.png"],
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
