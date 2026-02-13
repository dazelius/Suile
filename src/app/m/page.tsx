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
    images: [{ url: "/og-qr-letter.png", width: 1200, height: 630, alt: "SUILE - QR 비밀 메시지" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "비밀 메시지가 도착했어요",
    description: "누군가 보낸 비밀 메시지를 확인하세요.",
    images: ["/og-qr-letter.png"],
  },
};

export default function MessagePage() {
  return <MessageClient />;
}
