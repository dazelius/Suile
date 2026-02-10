"use client";

import { useState, useCallback } from "react";
import { Copy, Check, Share2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  url: string;
  title?: string;
  description?: string;
  /** QR코드 data URL (base64) - 공유 시 이미지 파일로 첨부 */
  qrDataUrl?: string | null;
}

/** data URL → File 변환 */
async function dataUrlToFile(
  dataUrl: string,
  filename: string
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

/**
 * 공유 컴포넌트
 * - QR코드 이미지 + 링크를 함께 공유 (navigator.share with files)
 * - 링크 복사: 클립보드 복사 (어디서든 동작)
 */
export function ShareButtons({
  url,
  title = "비밀 메시지가 도착했어요",
  description = "누군가 당신에게 비밀 메시지를 보냈어요. 열어보세요!",
  qrDataUrl,
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
      // QR 이미지가 있으면 파일로 첨부해서 공유
      if (qrDataUrl) {
        const file = await dataUrlToFile(qrDataUrl, "qr-secret-message.png");

        // navigator.share가 파일 공유를 지원하는지 확인
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text: `${description}\n${url}`,
            files: [file],
          });
          return;
        }
      }

      // 파일 공유 미지원 → 링크만 공유
      await navigator.share({ title, text: description, url });
    } catch {
      // 사용자가 취소하거나 미지원 → 링크 복사로 대체
      await copyLink();
    }
  }, [url, title, description, qrDataUrl, copyLink]);

  return (
    <div className="space-y-4">
      {/* QR코드 미리보기 */}
      {qrDataUrl && (
        <div className="flex flex-col items-center">
          <div className="rounded-2xl bg-white p-4 shadow-sm border">
            <img
              src={qrDataUrl}
              alt="비밀 메시지 QR코드"
              className="w-44 h-44 sm:w-52 sm:h-52"
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            이 QR코드를 스캔하면 비밀 메시지가 열려요
          </p>
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
          <QrCode className="h-4 w-4" />
          QR + 링크 공유
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
          : "QR코드 이미지와 링크가 함께 전송돼요 (카카오톡, 문자 등)"}
      </p>
    </div>
  );
}
