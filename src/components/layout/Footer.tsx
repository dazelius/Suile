import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8">
          {/* 브랜드 - 모바일에서 full width */}
          <div className="col-span-2 sm:col-span-1">
            <h3 className="font-bold text-base">{siteConfig.name}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              당신의 일상을 편리하게.
              <br />
              무료 온라인 도구를 한 곳에서.
            </p>
          </div>

          {/* 링크 */}
          <div>
            <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">바로가기</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>
                <Link
                  href="/"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  도구 모음
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  소개
                </Link>
              </li>
            </ul>
          </div>

          {/* 법적 */}
          <div>
            <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">정책</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  이용약관
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 border-t pt-4 text-center text-[11px] sm:text-xs text-muted-foreground">
          &copy; {currentYear} {siteConfig.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
