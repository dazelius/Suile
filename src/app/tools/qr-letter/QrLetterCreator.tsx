"use client";

import { useState, useCallback } from "react";
import QRCode from "qrcode";
import { RotateCcw, Eye, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { encodeLetterData, QrLetterData } from "@/lib/qr-data";
import { generateQrCard } from "@/lib/qr-card";
import { AdSlot } from "@/components/ads/AdSlot";
import { ShareButtons } from "@/components/share/ShareButtons";

const MAX_MESSAGE_LENGTH = 300;

/** 현재 브라우저 origin 반환 (localhost, 배포 도메인 자동 대응) */
function getOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function QrLetterCreator() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [letterUrl, setLetterUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"write" | "result">("write");

  const isValid = message.trim().length > 0;

  const generateQR = useCallback(async () => {
    if (!isValid) return;

    const trimmedFrom = from.trim() || "익명";
    const trimmedTo = to.trim() || "";

    const data: QrLetterData = {
      from: trimmedFrom,
      to: trimmedTo,
      message: message.trim(),
      theme: "secret",
    };

    const encoded = encodeLetterData(data);
    const url = `${getOrigin()}/m?d=${encoded}`;
    setLetterUrl(url);

    try {
      // 1. QR코드 생성
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: "#18181b", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });

      // 2. 카드 이미지 생성 (QR + 브랜딩 + 문구)
      const card = await generateQrCard({
        qrDataUrl,
        from: trimmedFrom,
        to: trimmedTo,
      });
      setCardDataUrl(card);

      setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("QR 생성 실패:", err);
    }
  }, [from, to, message, isValid]);

  const reset = () => {
    setFrom("");
    setTo("");
    setMessage("");
    setCardDataUrl(null);
    setLetterUrl(null);
    setStep("write");
  };

  const previewUrl = letterUrl
    ? letterUrl.replace(getOrigin(), "")
    : null;

  // ===== 작성 화면 =====
  if (step === "write") {
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="text-center py-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 text-white mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            QR 비밀 메시지
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto">
            QR코드 안에 비밀 메시지를 숨겨보세요.
            <br />
            스캔한 사람만 읽을 수 있어요.
          </p>
        </div>

        {/* 메시지 입력 */}
        <div className="space-y-1.5">
          <Textarea
            placeholder="비밀 메시지를 입력하세요..."
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                setMessage(e.target.value);
              }
            }}
            rows={6}
            className="resize-none text-base leading-relaxed border-2 focus:border-zinc-400"
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length}/{MAX_MESSAGE_LENGTH}자
          </p>
        </div>

        {/* 보내는/받는 사람 (선택) */}
        <details className="group">
          <summary className="text-sm text-muted-foreground cursor-pointer select-none py-1 hover:text-foreground transition-colors">
            보내는 사람 / 받는 사람 설정 (선택)
          </summary>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">보내는 사람</label>
              <Input
                placeholder="익명"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                maxLength={20}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">받는 사람</label>
              <Input
                placeholder="선택사항"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                maxLength={20}
                className="h-11"
              />
            </div>
          </div>
        </details>

        {/* 생성 버튼 */}
        <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t sm:relative sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
          <Button
            onClick={generateQR}
            disabled={!isValid}
            className="w-full h-12 text-base gap-2 bg-zinc-900 hover:bg-zinc-800"
            size="lg"
          >
            <Send className="h-4 w-4" />
            비밀 메시지 만들기
          </Button>
        </div>

        {/* 설명 */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold mb-3">어떻게 사용하나요?</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="space-y-1.5">
              <div className="text-2xl">✍️</div>
              <p className="text-xs font-medium">메시지 작성</p>
              <p className="text-[11px] text-muted-foreground">
                비밀 메시지를 입력
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-2xl">🔗</div>
              <p className="text-xs font-medium">카드 공유</p>
              <p className="text-[11px] text-muted-foreground">
                카톡·SNS로 전송
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-2xl">🔓</div>
              <p className="text-xs font-medium">메시지 확인</p>
              <p className="text-[11px] text-muted-foreground">
                링크 또는 QR 스캔
              </p>
            </div>
          </div>
        </div>

        {/* SEO 설명 */}
        <section className="space-y-3 text-sm text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">
            QR 비밀 메시지란?
          </h2>
          <p>
            QR 비밀 메시지는 QR코드 또는 링크로 비밀 메시지를 보내는
            서비스입니다. 카카오톡, 인스타그램 등 메신저로 링크를 보내거나,
            QR코드를 인쇄하여 카드에 붙일 수 있습니다.
          </p>
          <p>
            생일 축하, 사랑 고백, 감사 인사, 응원의 말을 비밀 메시지로
            전해보세요. 받는 사람이 열어보는 순간 특별한 감동을 전할 수
            있습니다.
          </p>
        </section>
      </div>
    );
  }

  // ===== 결과 화면 =====
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="text-center py-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 text-white mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          비밀 메시지 완성!
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          카드 이미지를 공유해보세요.
        </p>
      </div>

      {/* ========== 카드 공유 ========== */}
      <div className="rounded-xl border-2 border-zinc-200 bg-zinc-50 p-4">
        {letterUrl && (
          <ShareButtons
            url={letterUrl}
            title="비밀 메시지가 도착했어요"
            description="누군가 당신에게 비밀 메시지를 보냈어요. 열어보세요!"
            cardDataUrl={cardDataUrl}
          />
        )}
      </div>

      {/* ========== 미리보기 + 새로 만들기 ========== */}
      <div className="flex gap-2">
        {previewUrl && (
          <Button
            variant="outline"
            className="flex-1 h-11 gap-2 text-sm"
            asChild
          >
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4" />
              미리보기
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={reset}
          className="flex-1 h-11 gap-2 text-sm"
        >
          <RotateCcw className="h-4 w-4" />
          새로 만들기
        </Button>
      </div>

      {/* 광고 */}
      <AdSlot />

      {/* 활용 팁 */}
      <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-3">이런 곳에 활용해보세요</h2>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">💬</div>
            <p className="text-xs font-medium">카톡 · 메신저</p>
          </div>
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">📸</div>
            <p className="text-xs font-medium">인스타 · SNS</p>
          </div>
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">💌</div>
            <p className="text-xs font-medium">카드 · 편지</p>
          </div>
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">🎁</div>
            <p className="text-xs font-medium">선물 포장</p>
          </div>
        </div>
      </div>
    </div>
  );
}
