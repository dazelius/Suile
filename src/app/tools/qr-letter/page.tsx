import type { Metadata } from "next";
import { QrLetterCreator } from "./QrLetterCreator";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "블라인드 메시지 - Blind Message",
  description:
    "비밀 메시지를 보내보세요. 받는 사람만 열어볼 수 있는 블라인드 메시지. Send a blind message only the recipient can open.",
  keywords: [
    "블라인드 메시지",
    "Blind Message",
    "비밀 메시지",
    "secret message",
    "비밀 편지",
    "anonymous message",
  ],
  openGraph: {
    title: "블라인드 메시지 - SUILE",
    description:
      "비밀 메시지를 보내보세요. 받는 사람만 열어볼 수 있어요. Send a blind message only the recipient can open.",
    images: [{ url: "/og-qr-letter.png", width: 1200, height: 630, alt: "SUILE - 블라인드 메시지" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "블라인드 메시지 - SUILE",
    description:
      "비밀 메시지를 보내보세요. 받는 사람만 열어볼 수 있어요.",
    images: ["/og-qr-letter.png"],
  },
  alternates: {
    canonical: `${siteConfig.url}/tools/qr-letter`,
  },
};

export default function QrLetterPage() {
  return <QrLetterCreator />;
}
