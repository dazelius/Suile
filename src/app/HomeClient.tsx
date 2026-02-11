"use client";

import { tools, getActiveCategories, getToolsByCategory } from "@/config/tools";
import { ToolCard } from "@/components/layout/ToolCard";
import { AdSlot } from "@/components/ads/AdSlot";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Translations } from "@/lib/i18n";

export default function HomeClient() {
  const { t } = useI18n();
  const activeCategories = getActiveCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Hero */}
      <section className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
          {t("siteName")}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm sm:text-lg max-w-xl mx-auto">
          {t("siteSlogan")}
        </p>
      </section>

      {/* 광고 */}
      <AdSlot className="mb-6 sm:mb-8" />

      {/* 전체 도구 그리드 */}
      {tools.length <= 12 && (
        <section className="mb-8 sm:mb-12">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
            {t("homeAllTools")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t("homeToolCount", { count: String(tools.length) })}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      )}

      {/* 카테고리별 도구 */}
      {tools.length > 12 &&
        activeCategories.map((category) => {
          const categoryTools = getToolsByCategory(category.id);
          if (categoryTools.length === 0) return null;

          return (
            <section key={category.id} className="mb-8 sm:mb-10" id={category.id}>
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
                {category.nameKey
                  ? t(category.nameKey as keyof Translations)
                  : category.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {t("homeToolCount", { count: String(categoryTools.length) })}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
