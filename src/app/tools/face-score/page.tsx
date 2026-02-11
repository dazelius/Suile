import type { Metadata } from "next";
import { Suspense } from "react";
import FaceScoreClient from "./FaceScoreClient";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "AI 얼굴 평가 - Face Score | SUILE",
  description:
    "AI가 당신의 얼굴을 정밀 분석합니다. 좌우 대칭도, 부위별 점수, 추정 나이, 닮은 연예인까지!",
  keywords: [
    "얼굴평가",
    "AI얼굴분석",
    "외모점수",
    "face score",
    "얼굴대칭",
    "닮은연예인",
    "관상",
    "얼굴나이",
  ],
  openGraph: {
    title: "AI 얼굴 평가 - SUILE",
    description: "AI가 당신의 얼굴을 정밀 분석! 점수, 나이, 닮은 연예인까지",
    images: [
      {
        url: `${siteConfig.url}/face-score-og.png`,
        width: 800,
        height: 800,
        alt: "SUILE - AI 얼굴 평가",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "AI 얼굴 평가 - SUILE",
    description: "AI가 당신의 얼굴을 정밀 분석! 점수, 나이, 닮은 연예인까지",
    images: [`${siteConfig.url}/face-score-og.png`],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/face-score`,
  },
};

export default function FaceScorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <FaceScoreClient />
    </Suspense>
  );
}
