"use client";

import { useState, useCallback } from "react";
import { RotateCcw, Eye, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { encodeLetterData, QrLetterData } from "@/lib/qr-data";
import { generateQrCard } from "@/lib/qr-card";
import { AdSlot } from "@/components/ads/AdSlot";
import { ShareButtons } from "@/components/share/ShareButtons";
import { useI18n } from "@/components/i18n/I18nProvider";

const MAX_MESSAGE_LENGTH = 300;

/** 현재 브라우저 origin 반환 */
function getOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function QrLetterCreator() {
  const { t } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [letterUrl, setLetterUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"write" | "result">("write");

  const isValid = message.trim().length > 0;

  const generateQR = useCallback(async () => {
    if (!isValid) return;

    const trimmedFrom = from.trim() || t("anonymous");
    const trimmedTo = to.trim() || "";

    const data: QrLetterData = {
      from: trimmedFrom,
      to: trimmedTo,
      message: message.trim(),
      theme: "secret",
    };

    const encoded = encodeLetterData(data);
    const url = `${getOrigin()}/v?d=${encoded}`;
    setLetterUrl(url);

    try {
      const card = await generateQrCard({
        from: trimmedFrom,
        to: trimmedTo,
        message: message.trim(),
      });
      setCardDataUrl(card);

      setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("카드 생성 실패:", err);
    }
  }, [from, to, message, isValid, t]);

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
            {t("toolQrTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xs mx-auto whitespace-pre-line">
            {t("toolQrSubtitle")}
          </p>
        </div>

        {/* 메시지 입력 */}
        <div className="space-y-1.5">
          <Textarea
            placeholder={t("toolQrPlaceholder")}
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
            {t("toolQrCharCount", {
              current: String(message.length),
              max: String(MAX_MESSAGE_LENGTH),
            })}
          </p>
        </div>

        {/* 보내는/받는 사람 (선택) */}
        <details className="group">
          <summary className="text-sm text-muted-foreground cursor-pointer select-none py-1 hover:text-foreground transition-colors">
            {t("toolQrSenderReceiverToggle")}
          </summary>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("toolQrSenderLabel")}</label>
              <Input
                placeholder={t("toolQrSenderPlaceholder")}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                maxLength={20}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("toolQrReceiverLabel")}</label>
              <Input
                placeholder={t("toolQrReceiverPlaceholder")}
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
            {t("toolQrCreateBtn")}
          </Button>
        </div>

        {/* 설명 */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold mb-3">{t("toolQrHowTo")}</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="space-y-1.5">
              <div className="text-2xl">✍️</div>
              <p className="text-xs font-medium">{t("toolQrStep1Title")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("toolQrStep1Desc")}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-2xl">🔗</div>
              <p className="text-xs font-medium">{t("toolQrStep2Title")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("toolQrStep2Desc")}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-2xl">🔓</div>
              <p className="text-xs font-medium">{t("toolQrStep3Title")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("toolQrStep3Desc")}
              </p>
            </div>
          </div>
        </div>

        {/* SEO 설명 */}
        <section className="space-y-3 text-sm text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">
            {t("toolQrSeoTitle")}
          </h2>
          <p>{t("toolQrSeoDesc1")}</p>
          <p>{t("toolQrSeoDesc2")}</p>
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
          {t("toolQrResultTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("toolQrResultSubtitle")}
        </p>
      </div>

      {/* 카드 공유 */}
      <div className="rounded-xl border-2 border-zinc-200 bg-zinc-50 p-4">
        {letterUrl && (
          <ShareButtons
            url={letterUrl}
            cardDataUrl={cardDataUrl}
          />
        )}
      </div>

      {/* 미리보기 + 새로 만들기 */}
      <div className="flex gap-2">
        {previewUrl && (
          <Button
            variant="outline"
            className="flex-1 h-11 gap-2 text-sm"
            asChild
          >
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4" />
              {t("toolQrPreview")}
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={reset}
          className="flex-1 h-11 gap-2 text-sm"
        >
          <RotateCcw className="h-4 w-4" />
          {t("toolQrNewMessage")}
        </Button>
      </div>

      {/* 광고 */}
      <AdSlot />

      {/* 활용 팁 */}
      <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-3">{t("toolQrUseTip")}</h2>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">💬</div>
            <p className="text-xs font-medium">{t("toolQrUseChat")}</p>
          </div>
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">📸</div>
            <p className="text-xs font-medium">{t("toolQrUseSns")}</p>
          </div>
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">💌</div>
            <p className="text-xs font-medium">{t("toolQrUseLetter")}</p>
          </div>
          <div className="rounded-lg bg-background p-3 space-y-1">
            <div className="text-xl">🎁</div>
            <p className="text-xs font-medium">{t("toolQrUseGift")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
