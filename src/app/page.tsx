import { tools, getActiveCategories, getToolsByCategory } from "@/config/tools";
import { ToolCard } from "@/components/layout/ToolCard";
import { AdSlot } from "@/components/ads/AdSlot";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  const activeCategories = getActiveCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Hero - 모바일에서 간결하게 */}
      <section className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm sm:text-lg max-w-xl mx-auto">
          당신의 일상을 편리하게. 무료 온라인 도구를 한 곳에서.
        </p>
      </section>

      {/* 광고: Hero 아래 */}
      <AdSlot className="mb-6 sm:mb-8" />

      {/* 전체 도구 그리드 (도구가 적을 때) */}
      {tools.length <= 12 && (
        <section className="mb-8 sm:mb-12">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
            전체 도구
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {tools.length}개
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      )}

      {/* 카테고리별 도구 (도구가 많아지면 자동 전환) */}
      {tools.length > 12 &&
        activeCategories.map((category) => {
          const categoryTools = getToolsByCategory(category.id);
          if (categoryTools.length === 0) return null;

          return (
            <section key={category.id} className="mb-8 sm:mb-10" id={category.id}>
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
                {category.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {categoryTools.length}개
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
