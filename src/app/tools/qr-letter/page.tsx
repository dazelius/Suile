import type { Metadata } from "next";
import { QrLetterCreator } from "./QrLetterCreator";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "QR 비밀 메시지",
  description:
    "QR코드 안에 비밀 메시지를 숨겨보세요. 스캔한 사람만 읽을 수 있는 비밀 메시지를 만들어보세요.",
  keywords: [
    "QR코드 비밀메시지",
    "QR코드 메시지",
    "비밀 메시지",
    "QR코드 만들기",
    "큐알코드 메시지",
    "비밀 편지",
  ],
  openGraph: {
    title: "QR 비밀 메시지 - SUILE",
    description:
      "QR코드 안에 비밀 메시지를 숨겨보세요. 스캔한 사람만 읽을 수 있어요.",
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
    title: "QR 비밀 메시지 - SUILE",
    description: "QR코드 안에 비밀 메시지를 숨겨보세요.",
    images: [`${siteConfig.url}/og-qr.png`],
  },
};

export default function QrLetterPage() {
  return <QrLetterCreator />;
}
