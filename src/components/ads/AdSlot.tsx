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

const AD_CLIENT = "ca-pub-1349078633848665";

/**
 * 애드센스 광고 슬롯 컴포넌트
 *
 * - slot 없이 사용: 자동 광고(Auto Ads) 단위 표시
 * - slot 있으면: 해당 슬롯 ID 수동 배치
 *
 * 사용법:
 *   <AdSlot />                          ← 자동 광고
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
    if (pushed.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // 애드센스 아직 로드 안 됐거나 개발 환경
    }
  }, []);

  return (
    <div className={`ad-slot w-full overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        {...(slot ? { "data-ad-slot": slot } : {})}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
