import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: `${siteConfig.name} - 무료 온라인 도구 모음 | Free Online Tools`,
  description: siteConfig.description,
  openGraph: {
    title: `${siteConfig.name} - 무료 온라인 도구 모음`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - 무료 온라인 도구 모음`,
    description: siteConfig.description,
    images: ["/og.png"],
  },
  alternates: {
    canonical: siteConfig.url,
  },
};

export default function HomePage() {
  return <HomeClient />;
}
