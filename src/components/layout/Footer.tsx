"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8">
          {/* 브랜드 */}
          <div className="col-span-2 sm:col-span-1">
            <h3 className="font-bold text-base">{t("siteName")}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              {t("footerSlogan1")}
              <br />
              {t("footerSlogan2")}
            </p>
          </div>

          {/* 링크 */}
          <div>
            <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">
              {t("navQuickLinks")}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>
                <Link
                  href="/"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  {t("navTools")}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  {t("navAbout")}
                </Link>
              </li>
            </ul>
          </div>

          {/* 법적 */}
          <div>
            <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">
              {t("navPolicies")}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  {t("navPrivacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-foreground active:text-foreground transition-colors"
                >
                  {t("navTerms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 border-t pt-4 text-center text-[11px] sm:text-xs text-muted-foreground">
          &copy; {currentYear} {t("siteName")}. {t("footerCopyright")}
        </div>
      </div>
    </footer>
  );
}
