import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { MessageClient } from "./MessageClient";

export const metadata: Metadata = {
  title: "비밀 메시지가 도착했어요",
  description: "누군가 보낸 비밀 메시지를 확인하세요. QR코드와 함께 만나세요!",
  openGraph: {
    title: "비밀 메시지가 도착했어요",
    description: "누군가 보낸 비밀 메시지를 확인하세요. QR코드와 함께 만나세요!",
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: `${siteConfig.url}/og-qr.png`,
        width: 800,
        height: 800,
        alt: "SUILE - QR 비밀 메시지",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "비밀 메시지가 도착했어요",
    description: "누군가 보낸 비밀 메시지를 확인하세요.",
    images: [`${siteConfig.url}/og-qr.png`],
  },
};

export default function MessagePage() {
  return <MessageClient />;
}
