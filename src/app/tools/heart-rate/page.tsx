import type { Metadata } from "next";
import { Suspense } from "react";
import HeartRateClient from "./HeartRateClient";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "심박수 측정기 - Heart Rate Monitor | SUILE",
  description:
    "스마트폰 카메라에 손가락을 대면 심박수를 실시간 측정합니다. PPG 광전용적맥파 기술 기반.",
  keywords: [
    "심박수측정",
    "심박수",
    "맥박측정",
    "heart rate",
    "BPM",
    "PPG",
    "심박수측정기",
    "카메라심박수",
  ],
  openGraph: {
    title: "심박수 측정기 - SUILE",
    description: "카메라에 손가락만 대면 심박수 측정! PPG 기술 기반 실시간 측정",
    images: [
      {
        url: `${siteConfig.url}/heart-rate-og.png`,
        width: 1200,
        height: 630,
        alt: "SUILE - 심박수 측정기",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "심박수 측정기 - SUILE",
    description: "카메라에 손가락만 대면 심박수 측정! PPG 기술 기반 실시간 측정",
    images: [`${siteConfig.url}/heart-rate-og.png`],
  },
};

export default function HeartRatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <HeartRateClient />
    </Suspense>
  );
}
