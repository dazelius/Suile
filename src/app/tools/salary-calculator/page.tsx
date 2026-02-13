import type { Metadata } from "next";
import { Suspense } from "react";
import SalaryClient from "./SalaryClient";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "연봉 실수령액 계산기 - Salary Calculator | SUILE",
  description:
    "2026년 확정 요율 기준 연봉 실수령액 계산기. 4대보험, 소득세를 국세청 간이세액표 공식으로 정확하게 계산합니다.",
  keywords: [
    "연봉 실수령액",
    "실수령액 계산기",
    "연봉계산기",
    "세후 연봉",
    "4대보험",
    "소득세",
    "salary calculator",
    "take home pay",
    "2026",
  ],
  openGraph: {
    title: "연봉 실수령액 계산기 - SUILE",
    description:
      "2026년 확정 요율 기준! 연봉에서 4대보험·소득세 공제 후 실수령액을 정확히 계산합니다.",
    images: [{ url: "/og-salary-calc.png", width: 1200, height: 630, alt: "SUILE - 연봉 실수령액 계산기" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "연봉 실수령액 계산기 - SUILE",
    description:
      "2026년 확정 요율 기준! 연봉에서 4대보험·소득세 공제 후 실수령액을 정확히 계산합니다.",
    images: ["/og-salary-calc.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/salary-calculator`,
  },
};

export default function SalaryCalculatorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <SalaryClient />
    </Suspense>
  );
}
