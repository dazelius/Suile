import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import YoutuberBattleClient from "./YoutuberBattleClient";

export const metadata: Metadata = {
  title: "유튜버 배틀로얄 - YouTuber Battle Royale",
  description:
    "침착맨 vs MrBeast vs BLACKPINK — 구독자가 체력, 조회수가 화력! 유튜브 채널 데이터로 구슬을 만들어 부딪히는 유튜버 배틀로얄! 최후의 1인은?",
  keywords: [
    "유튜버 배틀로얄", "YouTuber Battle", "유튜브 배틀", "구독자 대결",
    "MrBeast", "침착맨", "PewDiePie", "BLACKPINK", "유튜브 게임",
    "구슬치기", "배틀로얄", "유튜버 대결",
  ],
  openGraph: {
    title: "유튜버 배틀로얄 — 구독자가 체력, 조회수가 화력!",
    description:
      "침착맨 vs MrBeast vs BLACKPINK — 실제 유튜브 데이터로 구슬을 만들어 충돌! 크리티컬, 흡수, 탈락까지. 살아남는 유튜버는 하나.",
    url: `${siteConfig.url}/tools/youtuber-battle`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-youtuber-battle.png", width: 1200, height: 630, alt: "유튜버 배틀로얄" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "유튜버 배틀로얄 — 구독자가 체력, 조회수가 화력!",
    description:
      "침착맨 vs MrBeast vs BLACKPINK — 실제 유튜브 데이터로 실시간 구슬 배틀! 크리·흡수·탈락. 살아남는 건 하나.",
    images: ["/og-youtuber-battle.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/youtuber-battle`,
  },
};

export default function YoutuberBattlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <YoutuberBattleClient />
    </Suspense>
  );
}
