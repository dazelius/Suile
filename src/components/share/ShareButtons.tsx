"use client";

import { useState, useCallback } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  url: string;
  title?: string;
  description?: string;
}

/**
 * 공유 컴포넌트
 * - 공유하기: navigator.share() (HTTPS + 모바일에서 카카오톡 등 앱 목록 표시)
 * - 링크 복사: 클립보드 복사 (어디서든 동작)
 */
export function ShareButtons({
  url,
  title = "비밀 메시지가 도착했어요",
  description = "누군가 당신에게 비밀 메시지를 보냈어요. 열어보세요!",
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [url]);

  const nativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, text: description, url });
    } catch {
      // 사용자가 취소하거나 미지원 → 링크 복사로 대체
      await copyLink();
    }
  }, [url, title, description, copyLink]);

  return (
    <div className="space-y-3">
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
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 공유 + 복사 버튼 */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={nativeShare}
          className="h-12 gap-2 text-sm bg-zinc-900 hover:bg-zinc-800"
        >
          <Share2 className="h-4 w-4" />
          공유하기
        </Button>
        <Button
          variant="outline"
          onClick={copyLink}
          className="h-12 gap-2 text-sm"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              복사 완료!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              링크 복사
            </>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        {copied
          ? "링크가 복사되었어요! 원하는 곳에 붙여넣기 하세요."
          : "공유하기를 누르면 카카오톡, 문자 등으로 바로 보낼 수 있어요"}
      </p>
    </div>
  );
}
