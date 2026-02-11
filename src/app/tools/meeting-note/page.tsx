import type { Metadata } from "next";
import { Suspense } from "react";
import MeetingNoteClient from "./MeetingNoteClient";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "회의록 AI 정리 - Meeting Notes | SUILE",
  description:
    "회의를 녹음하면 실시간 텍스트 변환 후 AI가 자동으로 요약, 액션 아이템, 결정사항을 정리합니다.",
  keywords: [
    "회의록",
    "회의록정리",
    "AI회의록",
    "음성인식",
    "회의요약",
    "meeting notes",
    "STT",
    "액션아이템",
  ],
  openGraph: {
    title: "회의록 AI 정리 - SUILE",
    description:
      "녹음 → 텍스트 변환 → AI 자동 정리! 회의록을 한번에",
    images: [
      {
        url: `${siteConfig.url}/meeting-note-og.png`,
        width: 1200,
        height: 630,
        alt: "SUILE - 회의록 AI 정리",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "회의록 AI 정리 - SUILE",
    description:
      "녹음 → 텍스트 변환 → AI 자동 정리! 회의록을 한번에",
    images: [`${siteConfig.url}/meeting-note-og.png`],
  },
};

export default function MeetingNotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <MeetingNoteClient />
    </Suspense>
  );
}
