import type { Metadata } from "next";
import { Suspense } from "react";
import WorkScheduleClient from "./WorkScheduleClient";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "근무표 - 3조 교대 근무 달력 | SUILE",
  description:
    "A·B·C 3개 조의 주간·야간·비번 근무표를 한눈에 확인하세요. 공휴일 표시, 다크모드, 다음 비번 D-Day 제공.",
  keywords: [
    "근무표",
    "교대근무",
    "3조2교대",
    "야간근무",
    "주간근무",
    "비번",
    "근무달력",
    "work schedule",
    "shift calendar",
  ],
  openGraph: {
    title: "근무표 - 3조 교대 근무 달력 | SUILE",
    description: "A·B·C 3개 조의 주간·야간·비번 근무표를 한눈에 확인하세요.",
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/work-schedule`,
  },
};

export default function WorkSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <WorkScheduleClient />
    </Suspense>
  );
}
