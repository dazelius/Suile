"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  ImageIcon,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  url: string;
  title?: string;
  description?: string;
  /** 카드 이미지 data URL (QR + 브랜딩 + 문구가 합성된 이미지) */
  cardDataUrl?: string | null;
}

/** data URL → Blob */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** data URL → File */
async function dataUrlToFile(
  dataUrl: string,
  filename: string
): Promise<File> {
  const blob = await dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
}

export function ShareButtons({
  url,
  title = "비밀 메시지가 도착했어요",
  description = "누군가 당신에게 비밀 메시지를 보냈어요. 열어보세요!",
  cardDataUrl,
}: ShareButtonsProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);

  // ── 링크 복사 ──
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

  // ── 카드 이미지 클립보드 복사 ──
  const copyCardImage = useCallback(async () => {
    if (!cardDataUrl) return;
    try {
      const blob = await dataUrlToBlob(cardDataUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 2500);
    } catch {
      // 미지원 → 다운로드로 대체
      downloadCard();
    }
  }, [cardDataUrl]);

  // ── 카드 이미지 다운로드 ──
  const downloadCard = useCallback(() => {
    if (!cardDataUrl) return;
    const link = document.createElement("a");
    link.download = "qr-secret-message.png";
    link.href = cardDataUrl;
    link.click();
  }, [cardDataUrl]);

  // ── 네이티브 공유 (모바일: 카드 이미지 + 링크) ──
  const nativeShare = useCallback(async () => {
    try {
      if (cardDataUrl) {
        const file = await dataUrlToFile(
          cardDataUrl,
          "qr-secret-message.png"
        );
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title,
            text: `${description}\n${url}`,
            files: [file],
          });
          return;
        }
      }
      await navigator.share({ title, text: description, url });
    } catch {
      await copyLink();
    }
  }, [url, title, description, cardDataUrl, copyLink]);

  return (
    <div className="space-y-4">
      {/* 카드 이미지 미리보기 */}
      {cardDataUrl && (
        <div className="flex flex-col items-center">
          <div className="rounded-2xl overflow-hidden shadow-lg border border-zinc-200 max-w-[300px] sm:max-w-[340px]">
            <img
              src={cardDataUrl}
              alt="QR 비밀 메시지 카드"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}

      {/* 메인 공유 버튼 */}
      <Button
        onClick={nativeShare}
        className="w-full h-12 gap-2 text-sm bg-zinc-900 hover:bg-zinc-800"
      >
        <Share2 className="h-4 w-4" />
        카드 이미지 공유하기
      </Button>

      {/* 이미지 복사 / 저장 */}
      {cardDataUrl && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={copyCardImage}
            className="h-11 gap-2 text-sm"
          >
            {copiedImg ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                복사 완료!
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                이미지 복사
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={downloadCard}
            className="h-11 gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            이미지 저장
          </Button>
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
        {copiedImg
          ? "카드 이미지가 복사됐어요! 카톡/메신저에 붙여넣기 하세요."
          : copiedLink
            ? "링크가 복사되었어요! 원하는 곳에 붙여넣기 하세요."
            : "카드 이미지와 링크가 함께 전송돼요 (카카오톡, 문자 등)"}
      </p>
    </div>
  );
}
