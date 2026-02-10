"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getActiveCategories, getToolsByCategory } from "@/config/tools";
import { Button } from "@/components/ui/button";

export function TopBar() {
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
            <span>{siteConfig.name}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm">
                홈
              </Button>
            </Link>

            {/* 도구 드롭다운 */}
            <div
              className="relative"
              onMouseEnter={() => setDesktopDropdown(true)}
              onMouseLeave={() => setDesktopDropdown(false)}
            >
              <Button variant="ghost" size="sm" className="gap-1">
                도구 모음
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>

              {desktopDropdown && (
                <div className="absolute top-full left-0 mt-0 w-64 rounded-lg border bg-popover p-2 shadow-lg">
                  {activeCategories.map((category) => {
                    const categoryTools = getToolsByCategory(category.id);
                    return (
                      <div key={category.id} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {category.name}
                        </p>
                        {categoryTools.map((tool) => (
                          <Link
                            key={tool.id}
                            href={tool.path}
                            className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                            onClick={() => setDesktopDropdown(false)}
                          >
                            {tool.name}
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Menu Toggle - 터치 영역 48px 이상 */}
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 -mr-2 rounded-lg active:bg-accent transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
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
                홈
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <div className="my-2 h-px bg-border" />

              {/* 카테고리별 도구 */}
              {activeCategories.map((category) => {
                const categoryTools = getToolsByCategory(category.id);
                return (
                  <div key={category.id}>
                    <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category.name}
                    </p>
                    {categoryTools.map((tool) => (
                      <Link
                        key={tool.id}
                        href={tool.path}
                        className="flex items-center justify-between py-3 px-3 rounded-xl text-sm active:bg-accent transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span>{tool.name}</span>
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
