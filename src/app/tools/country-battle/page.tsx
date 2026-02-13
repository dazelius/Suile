import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import CountryBattleClient from "./CountryBattleClient";

export const metadata: Metadata = {
  title: "나라 배틀로얄 - Country Battle Royale",
  description:
    "한국 vs 일본 vs 미국 vs 중국 — 실제 경제 데이터로 구슬을 만들어 부딪히는 나라 배틀로얄! GDP가 곧 체력, 인플레이션이 치명타, FDI가 회복력. 세계 경제 패권국을 가려라!",
  keywords: [
    "나라 배틀로얄", "국가 배틀", "경제 게임", "country battle royale",
    "GDP 비교", "경제 시뮬레이터", "한국 vs 일본", "미국 vs 중국",
    "World Bank", "구슬치기", "경제 데이터",
  ],
  openGraph: {
    title: "나라 배틀로얄 — 8개국, 세계 경제 패권국을 가려라!",
    description:
      "한국 vs 일본 vs 미국 vs 중국 — 실제 GDP·인플레·실업률로 구슬을 만들어 충돌! 경제 위기, 파산, 흡수까지. 살아남는 나라는 하나.",
    url: `${siteConfig.url}/tools/country-battle`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-country-battle.png", width: 1200, height: 630, alt: "나라 배틀로얄" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "나라 배틀로얄 — 8개국, 세계 경제 패권국을 가려라!",
    description:
      "한국 vs 일본 vs 미국 vs 중국 — 실제 경제 데이터로 실시간 구슬 배틀! 인플레·파산·흡수. 살아남는 건 하나.",
    images: ["/og-country-battle.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/country-battle`,
  },
};

export default function CountryBattlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <CountryBattleClient />
    </Suspense>
  );
}
