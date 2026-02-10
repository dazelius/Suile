"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/I18nProvider";

interface ShareButtonsProps {
  url: string;
  /** 카드 이미지 data URL (미리보기용) */
  cardDataUrl?: string | null;
}

export function ShareButtons({ url, cardDataUrl }: ShareButtonsProps) {
  const { t } = useI18n();
  const [copiedLink, setCopiedLink] = useState(false);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }, [url]);

  return (
    <div className="space-y-4">
      {/* 카드 이미지 미리보기 */}
      {cardDataUrl && (
        <div className="flex flex-col items-center">
          <div className="rounded-2xl overflow-hidden shadow-lg border border-zinc-200 max-w-[300px] sm:max-w-[340px]">
            <img
              src={cardDataUrl}
              alt={t("siteName")}
              className="w-full h-auto"
            />
          </div>
        </div>
      )}

      {/* 링크 표시 + 복사 */}
      <div className="flex gap-2">
        <div className="flex-1 min-w-0 rounded-lg border bg-white px-3 py-2.5 text-xs text-muted-foreground truncate select-all">
          {url}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={copyLink}
        >
          {copiedLink ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        {copiedLink
          ? t("shareCopiedLink")
          : t("shareHint")}
      </p>
    </div>
  );
}
