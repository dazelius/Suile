import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import ShortFormClient from "./ShortFormClient";

export const metadata: Metadata = {
  title: "숏폼 편집기 - Short-form Video Editor",
  description:
    "브라우저에서 바로! 영상 트리밍, 9:16 세로 크롭, 자막 추가까지. 서버 업로드 없이 100% 로컬에서 숏폼 영상을 편집하고 다운로드하세요.",
  keywords: [
    "숏폼 편집기", "숏폼 영상", "short form editor", "video editor",
    "영상 편집", "세로 영상", "9:16 크롭", "자막 추가",
    "유튜브 쇼츠", "틱톡", "릴스", "shorts editor",
    "브라우저 영상 편집", "무료 영상 편집",
  ],
  openGraph: {
    title: "숏폼 편집기 — 브라우저에서 바로 편집!",
    description:
      "영상 업로드 → 트리밍 → 9:16 크롭 → 자막 추가 → 다운로드. 서버 업로드 없이 100% 브라우저에서 동작하는 무료 숏폼 편집기.",
    url: `${siteConfig.url}/tools/short-form`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-qr.png", width: 800, height: 800, alt: "숏폼 편집기" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "숏폼 편집기 — 브라우저에서 바로 편집!",
    description:
      "트리밍 + 세로 크롭 + 자막. 서버 없이 브라우저에서 숏폼 영상 편집.",
    images: ["/og-qr.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/short-form`,
  },
};

export default function ShortFormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <ShortFormClient />
    </Suspense>
  );
}
