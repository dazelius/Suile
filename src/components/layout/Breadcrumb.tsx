"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { getToolByPath, getCategoryById } from "@/config/tools";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Translations } from "@/lib/i18n";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items: BreadcrumbItem[] = buildBreadcrumb(pathname, t);

  if (items.length === 0) return null;

  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground overflow-x-auto scrollbar-none">
        <li className="shrink-0">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground active:text-foreground transition-colors py-1"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("breadcrumbHome")}</span>
          </Link>
        </li>

        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="h-3 w-3 shrink-0" />
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-foreground active:text-foreground transition-colors py-1"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium py-1">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function buildBreadcrumb(
  pathname: string,
  t: (key: keyof Translations, params?: Record<string, string>) => string
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];

  if (pathname.startsWith("/tools/")) {
    const tool = getToolByPath(pathname);

    if (tool) {
      const category = getCategoryById(tool.category);
      if (category) {
        items.push({
          label: category.nameKey
            ? t(category.nameKey as keyof Translations)
            : category.name,
          href: `/?category=${category.id}`,
        });
      }
      items.push({
        label: tool.nameKey
          ? t(tool.nameKey as keyof Translations)
          : tool.name,
      });
    }
  }

  return items;
}
