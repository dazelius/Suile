"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Lock, Unlock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decodeLetterData, QrLetterData } from "@/lib/qr-data";
import { siteConfig } from "@/config/site";
import { AdSlot } from "@/components/ads/AdSlot";

interface LetterViewProps {
  encoded: string;
}

export function LetterView({ encoded }: LetterViewProps) {
  const [letterData, setLetterData] = useState<QrLetterData | null>(null);
  const [isOpened, setIsOpened] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const data = decodeLetterData(encoded);
    if (data) {
      setLetterData(data);
    } else {
      setError(true);
    }
  }, [encoded]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 bg-zinc-50">
        <div className="w-14 h-14 rounded-2xl bg-zinc-200 flex items-center justify-center">
          <Lock className="h-6 w-6 text-zinc-400" />
        </div>
        <p className="text-lg font-semibold">메시지를 찾을 수 없습니다</p>
        <p className="text-muted-foreground text-sm text-center">
          잘못된 QR코드이거나 링크가 손상되었습니다.
        </p>
        <Link href="/">
          <Button variant="outline" className="h-12 px-6 text-base">
            홈으로 돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  if (!letterData) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-transparent" />
      </div>
    );
  }

  const hasTo = letterData.to && letterData.to.length > 0;
  const hasFrom = letterData.from && letterData.from !== "익명";

  return (
    <div className="min-h-dvh bg-zinc-50 flex flex-col items-center justify-center px-5 py-12 safe-area-inset">
      <AnimatePresence mode="wait">
        {!isOpened ? (
          /* ===== 잠금 화면 ===== */
          <motion.div
            key="locked"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-8 w-full max-w-xs"
          >
            {/* 잠금 아이콘 */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{
                repeat: Infinity,
                duration: 2.5,
                ease: "easeInOut",
              }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center shadow-2xl">
                <Lock className="h-8 w-8 text-white" />
              </div>
              {/* 빛나는 점 */}
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse border-2 border-zinc-50" />
            </motion.div>

            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-zinc-900">
                비밀 메시지가 도착했어요
              </p>
              {hasTo && (
                <p className="text-sm text-zinc-500">
                  {letterData.to}님에게 온 메시지
                </p>
              )}
              {hasFrom && !hasTo && (
                <p className="text-sm text-zinc-500">
                  {letterData.from}님이 보낸 메시지
                </p>
              )}
              {!hasFrom && !hasTo && (
                <p className="text-sm text-zinc-500">
                  누군가 보낸 비밀 메시지
                </p>
              )}
            </div>

            <motion.div whileTap={{ scale: 0.95 }} className="w-full">
              <Button
                size="lg"
                onClick={() => setIsOpened(true)}
                className="w-full h-14 text-base gap-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 shadow-lg active:shadow-md transition-shadow"
              >
                <Unlock className="h-5 w-5" />
                메시지 열기
              </Button>
            </motion.div>

            <p className="text-[11px] text-zinc-400">
              QR코드를 스캔하면 이 페이지가 열려요
            </p>
          </motion.div>
        ) : (
          /* ===== 메시지 공개 ===== */
          <motion.div
            key="message"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            {/* 메시지 카드 */}
            <div className="rounded-2xl bg-white border border-zinc-200 shadow-xl overflow-hidden">
              {/* 상단 바 */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100 bg-zinc-50/50">
                <Unlock className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-zinc-500 font-medium">
                  비밀 메시지가 공개되었습니다
                </span>
              </div>

              {/* 메시지 본문 */}
              <div className="px-5 py-6">
                {hasTo && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs text-zinc-400 mb-4"
                  >
                    To. {letterData.to}
                  </motion.p>
                )}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="whitespace-pre-wrap text-base leading-relaxed text-zinc-800"
                >
                  {letterData.message}
                </motion.div>

                {hasFrom && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-6 text-right text-xs text-zinc-400"
                  >
                    From. {letterData.from}
                  </motion.p>
                )}
              </div>
            </div>

            {/* 나도 만들기 CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 text-center"
            >
              <Link href="/tools/qr-letter">
                <Button
                  variant="outline"
                  className="gap-2 rounded-full h-12 px-6 text-sm active:scale-95 transition-transform"
                >
                  <QrCode className="h-4 w-4" />
                  나도 비밀 메시지 보내기
                </Button>
              </Link>
              <p className="mt-3 text-[11px] text-zinc-400">
                {siteConfig.name} - QR 비밀 메시지
              </p>

              {/* 광고 */}
              <div className="mt-6">
                <AdSlot />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
