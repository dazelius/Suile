import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { PegChartClient } from "./PegChartClient";

export const metadata: Metadata = {
  title: "PEG 비율 차트 - PEG Ratio Chart",
  description:
    "여러 종목의 분기별 PEG 비율을 한눈에 비교하세요. 성장성 대비 주가가 저평가인지 고평가인지 확인할 수 있습니다.",
  keywords: [
    "PEG 비율", "PEG ratio", "주식 밸류에이션", "분기별 PEG",
    "PE ratio", "EPS 성장률", "주가 분석", "저평가 종목",
  ],
  openGraph: {
    title: "PEG 비율 차트",
    description: "여러 종목의 분기별 PEG 비율을 한눈에 비교하세요.",
    url: `${siteConfig.url}/tools/peg-chart`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-peg-chart.png", width: 1200, height: 630, alt: "PEG 비율 차트" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PEG 비율 차트",
    description: "종목별 분기 PEG 추이를 시각화하여 비교합니다.",
    images: ["/og-peg-chart.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/peg-chart`,
  },
};

export default function PegChartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PegChartClient />
    </Suspense>
  );
}
