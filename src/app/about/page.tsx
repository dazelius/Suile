import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "소개 - About",
  description:
    "SUILE은 누구나 무료로 사용할 수 있는 온라인 도구 모음입니다. 빠르고 안전한 웹 기반 도구를 제공합니다.",
  openGraph: {
    title: "SUILE 소개",
    description:
      "SUILE은 누구나 무료로 사용할 수 있는 온라인 도구 모음입니다.",
    url: `${siteConfig.url}/about`,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
  },
  alternates: {
    canonical: `${siteConfig.url}/about`,
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
