"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdSlotProps {
  /** 애드센스 광고 슬롯 ID (승인 후 생성해서 넣기) */
  slot?: string;
  /** 광고 형식 */
  format?: "auto" | "fluid" | "horizontal" | "vertical" | "rectangle";
  /** 추가 className */
  className?: string;
}

/**
 * 애드센스 광고 슬롯 컴포넌트
 *
 * - 승인 전: 자동 광고(Auto Ads)가 구글이 알아서 배치
 * - 승인 후: slot prop에 슬롯 ID 넣으면 수동 배치도 가능
 *
 * 사용법:
 *   <AdSlot />                          ← 자동 광고용 자리 확보
 *   <AdSlot slot="1234567890" />         ← 특정 슬롯 수동 배치
 */
export function AdSlot({
  slot,
  format = "auto",
  className = "",
}: AdSlotProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !slot) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // 애드센스 아직 로드 안 됐거나 개발 환경
    }
  }, [slot]);

  // 슬롯 ID가 없으면 자동 광고가 알아서 이 영역 근처에 배치
  // 빈 div로 공간만 확보 (자동 광고 힌트 역할)
  if (!slot) {
    return (
      <div
        className={`ad-slot w-full min-h-[50px] ${className}`}
        data-ad-status="auto"
      />
    );
  }

  return (
    <div className={`ad-slot w-full overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-1349078633848665"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
