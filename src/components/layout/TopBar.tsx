"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { getActiveCategories, getToolsByCategory } from "@/config/tools";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import type { Translations } from "@/lib/i18n";

export function TopBar() {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopDropdown, setDesktopDropdown] = useState(false);
  const activeCategories = getActiveCategories();

  // 모바일 메뉴 열린 상태에서 스크롤 방지
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
        <div className="mx-auto flex h-12 sm:h-14 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-base sm:text-lg active:opacity-70 transition-opacity"
            onClick={() => setMobileOpen(false)}
          >
            <Wrench className="h-5 w-5 text-primary" />
            <span>{t("siteName")}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm">
                {t("navHome")}
              </Button>
            </Link>

            {/* 도구 드롭다운 */}
            <div
              className="relative"
              onMouseEnter={() => setDesktopDropdown(true)}
              onMouseLeave={() => setDesktopDropdown(false)}
            >
              <Button variant="ghost" size="sm" className="gap-1">
                {t("navTools")}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>

              {desktopDropdown && (
                <div className="absolute top-full left-0 mt-0 w-64 rounded-lg border bg-popover p-2 shadow-lg">
                  {activeCategories.map((category) => {
                    const categoryTools = getToolsByCategory(category.id);
                    return (
                      <div key={category.id} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {category.nameKey
                            ? t(category.nameKey as keyof Translations)
                            : category.name}
                        </p>
                        {categoryTools.map((tool) => (
                          <Link
                            key={tool.id}
                            href={tool.path}
                            className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                            onClick={() => setDesktopDropdown(false)}
                          >
                            {tool.nameKey
                              ? t(tool.nameKey as keyof Translations)
                              : tool.name}
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <LocaleSwitcher />
          </nav>

          {/* Mobile: locale + menu */}
          <div className="md:hidden flex items-center gap-1">
            <LocaleSwitcher />
            <button
              className="flex items-center justify-center w-10 h-10 -mr-2 rounded-lg active:bg-accent transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? t("menuClose") : t("menuOpen")}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-screen Overlay Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* 메뉴 패널 */}
          <div className="absolute top-12 left-0 right-0 bottom-0 bg-background overflow-y-auto overscroll-contain">
            <div className="px-4 py-4 pb-safe space-y-1">
              {/* 홈 */}
              <Link
                href="/"
                className="flex items-center justify-between py-3 px-3 rounded-xl text-base font-medium active:bg-accent transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {t("navHome")}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <div className="my-2 h-px bg-border" />

              {/* 카테고리별 도구 */}
              {activeCategories.map((category) => {
                const categoryTools = getToolsByCategory(category.id);
                return (
                  <div key={category.id}>
                    <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category.nameKey
                        ? t(category.nameKey as keyof Translations)
                        : category.name}
                    </p>
                    {categoryTools.map((tool) => (
                      <Link
                        key={tool.id}
                        href={tool.path}
                        className="flex items-center justify-between py-3 px-3 rounded-xl text-sm active:bg-accent transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span>
                          {tool.nameKey
                            ? t(tool.nameKey as keyof Translations)
                            : tool.name}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
