"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";

/**
 * 경로에 따라 TopBar/Footer를 조건부로 렌더링합니다.
 * /m/* 경로 (메시지 열람)에서는 TopBar/Footer를 숨깁니다.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 메시지 열람 페이지는 풀스크린
  const isFullscreen = pathname.startsWith("/m/");

  if (isFullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
