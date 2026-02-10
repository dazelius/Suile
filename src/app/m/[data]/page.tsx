import type { Metadata } from "next";
import { LetterView } from "./LetterView";
import { decodeLetterData } from "@/lib/qr-data";
import { siteConfig } from "@/config/site";

interface PageProps {
  params: Promise<{ data: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { data: encoded } = await params;
  const letterData = decodeLetterData(decodeURIComponent(encoded));

  if (!letterData) {
    return {
      title: "메시지를 찾을 수 없습니다",
    };
  }

  const hasTo = letterData.to && letterData.to.length > 0;
  const hasFrom = letterData.from && letterData.from !== "익명";

  const title = hasTo
    ? `${letterData.to}님에게 비밀 메시지가 도착했어요`
    : "비밀 메시지가 도착했어요";

  const description = hasFrom
    ? `${letterData.from}님이 보낸 비밀 메시지를 확인하세요. QR코드와 함께 만나세요!`
    : "누군가 보낸 비밀 메시지를 확인하세요. QR코드와 함께 만나세요!";

  const ogImage = `${siteConfig.url}/og-qr.png`;

  return {
    title,
    description,

    // Open Graph (카카오톡, 페이스북, 인스타, 라인 등)
    openGraph: {
      title,
      description,
      siteName: siteConfig.name,
      locale: "ko_KR",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 800,
          height: 800,
          alt: "SUILE - QR 비밀 메시지",
        },
      ],
    },

    // Twitter (X) 카드
    twitter: {
      card: "summary",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function MessagePage({ params }: PageProps) {
  const { data: encoded } = await params;
  return <LetterView encoded={decodeURIComponent(encoded)} />;
}
