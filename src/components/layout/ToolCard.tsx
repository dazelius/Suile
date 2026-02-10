import Link from "next/link";
import {
  QrCode,
  Type,
  Image,
  Calculator,
  ArrowLeftRight,
  Wand2,
  Heart,
  Code,
  MessageCircle,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ToolConfig } from "@/types/tool";

// 아이콘 매핑 - 새 아이콘 사용 시 여기에 추가
const iconMap: Record<string, LucideIcon> = {
  QrCode,
  Type,
  Image,
  Calculator,
  ArrowLeftRight,
  Wand2,
  Heart,
  Code,
  MessageCircle,
};

interface ToolCardProps {
  tool: ToolConfig;
}

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = iconMap[tool.icon] || Wand2;

  return (
    <Link href={tool.path} className="group block">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-all duration-200 active:scale-[0.98] hover:shadow-md hover:border-primary/30 sm:hover:-translate-y-0.5">
        {/* 아이콘 */}
        <div className="shrink-0 rounded-xl bg-primary/10 p-3 text-primary group-hover:bg-primary/15 transition-colors">
          <Icon className="h-5 w-5" />
        </div>

        {/* 텍스트 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-medium text-sm sm:text-base truncate">
              {tool.name}
            </h3>
            {tool.isNew && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                NEW
              </Badge>
            )}
            {tool.isPopular && (
              <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-orange-100 text-orange-700 hover:bg-orange-100">
                인기
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground line-clamp-1">
            {tool.description}
          </p>
        </div>

        {/* 모바일 화살표 */}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
      </div>
    </Link>
  );
}
