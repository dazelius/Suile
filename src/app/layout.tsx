import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { I18nProvider } from "@/components/i18n/I18nProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} - 블라인드 메시지 | Blind Message`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  openGraph: {
    title: `${siteConfig.name} - 블라인드 메시지`,
    description:
      "비밀 메시지를 보내보세요. 받는 사람만 열어볼 수 있는 블라인드 메시지 서비스.",
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: `${siteConfig.url}/og-qr.png`,
        width: 800,
        height: 800,
        alt: "SUILE - 블라인드 메시지",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.name} - 블라인드 메시지`,
    description:
      "비밀 메시지를 보내보세요. 받는 사람만 열어볼 수 있는 블라인드 메시지 서비스.",
    images: [`${siteConfig.url}/og-qr.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1349078633848665"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased overscroll-none`}
      >
        <I18nProvider>
          <LayoutShell>{children}</LayoutShell>
        </I18nProvider>
      </body>
    </html>
  );
}
