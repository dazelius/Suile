import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { MonteCarloClient } from "./MonteCarloClient";

export const metadata: Metadata = {
  title: "몬테카를로 시뮬레이터 - Monte Carlo Simulator",
  description:
    "과거 주식 데이터 기반 몬테카를로 시뮬레이션으로 미래 수익률을 예측하세요. 2,000개의 시나리오로 투자 확률을 분석합니다. Monte Carlo stock simulation.",
  keywords: [
    "몬테카를로", "Monte Carlo", "주식 예측", "미래 수익률",
    "투자 시뮬레이션", "Stock Prediction", "GBM", "시뮬레이터",
  ],
  openGraph: {
    title: "몬테카를로 시뮬레이터",
    description: "과거 주식 데이터 기반 몬테카를로 시뮬레이션으로 미래 수익률을 예측하세요.",
    url: `${siteConfig.url}/tools/monte-carlo`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-qr.png", width: 800, height: 800, alt: "몬테카를로 시뮬레이터" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "몬테카를로 시뮬레이터",
    description: "2,000개의 시나리오로 투자 확률을 분석하세요.",
    images: ["/og-qr.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/monte-carlo`,
  },
};

export default function MonteCarloPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <MonteCarloClient />
    </Suspense>
  );
}
