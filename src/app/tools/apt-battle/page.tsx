import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import AptBattleClient from "./AptBattleClient";

export const metadata: Metadata = {
  title: "아파트 배틀 - 전국 부동산 실거래가 비교",
  description:
    "전국 아파트 실거래가로 평당가 상승률 대결! 우리 동네 아파트 vs 그 동네 아파트, 어디가 더 올랐을까?",
  keywords: [
    "아파트 배틀", "부동산 비교", "실거래가", "평당가",
    "아파트 가격 비교", "부동산 시세", "래미안 vs 자이", "강남 아파트",
  ],
  openGraph: {
    title: "아파트 배틀 - 전국 부동산 실거래가 비교",
    description: "전국 아파트 실거래가로 평당가 상승률 대결! 어디가 더 올랐을까?",
    url: `${siteConfig.url}/tools/apt-battle`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-apt-battle.png", width: 1200, height: 630, alt: "아파트 배틀" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "아파트 배틀 - 전국 부동산 실거래가 비교",
    description: "전국 아파트 실거래가로 평당가 상승률 대결!",
    images: ["/og-apt-battle.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/apt-battle`,
  },
};

export default function AptBattlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <AptBattleClient />
    </Suspense>
  );
}
