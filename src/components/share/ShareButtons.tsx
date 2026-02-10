"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Check,
  QrCode,
  Download,
  ImageIcon,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  url: string;
  title?: string;
  description?: string;
  /** QR코드 data URL (base64) */
  qrDataUrl?: string | null;
}

/** data URL → Blob 변환 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** data URL → File 변환 */
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
  qrDataUrl,
}: ShareButtonsProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);

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

  // ── QR 이미지 클립보드 복사 (데스크톱에서 카톡 등에 붙여넣기 가능) ──
  const copyQrImage = useCallback(async () => {
    if (!qrDataUrl) return;
    try {
      const blob = await dataUrlToBlob(qrDataUrl);
      // PNG blob을 ClipboardItem으로 복사
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 2500);
    } catch {
      // Clipboard API 미지원 → QR 다운로드로 대체
      downloadQr();
    }
  }, [qrDataUrl]);

  // ── QR 이미지 다운로드 ──
  const downloadQr = useCallback(() => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = "qr-secret-message.png";
    link.href = qrDataUrl;
    link.click();
  }, [qrDataUrl]);

  // ── 네이티브 공유 (모바일: QR 이미지 + 링크 함께 전송) ──
  const nativeShare = useCallback(async () => {
    try {
      if (qrDataUrl) {
        const file = await dataUrlToFile(qrDataUrl, "qr-secret-message.png");
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
  }, [url, title, description, qrDataUrl, copyLink]);

  return (
    <div className="space-y-4">
      {/* QR코드 이미지 */}
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
          {copiedLink ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 메인 액션 버튼들 */}
      <div className="space-y-2">
        {/* 모바일: QR + 링크 함께 공유 */}
        <Button
          onClick={nativeShare}
          className="w-full h-12 gap-2 text-sm bg-zinc-900 hover:bg-zinc-800"
        >
          <Share2 className="h-4 w-4" />
          QR코드 + 링크 공유하기
        </Button>

        {/* QR 이미지 관련 버튼들 */}
        {qrDataUrl && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={copyQrImage}
              className="h-11 gap-2 text-sm"
            >
              {copiedQr ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  복사 완료!
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4" />
                  QR 이미지 복사
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={downloadQr}
              className="h-11 gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              QR 이미지 저장
            </Button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        {copiedQr
          ? "QR 이미지가 복사됐어요! 카톡/메신저에 붙여넣기(Ctrl+V) 하세요."
          : copiedLink
            ? "링크가 복사되었어요! 원하는 곳에 붙여넣기 하세요."
            : "공유하기 → 카톡·문자로 전송 | QR 이미지 복사 → 붙여넣기"}
      </p>
    </div>
  );
}
