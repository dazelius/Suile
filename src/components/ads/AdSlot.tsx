"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdSlotProps {
  /** 애드센스 광고 슬롯 ID (애드센스에서 광고 단위 생성 후 넣기) */
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
 * 사용법:
 *   <AdSlot slot="1234567890" />
 *
 * ⚠️ slot 없이 push({})를 호출하면 vignette(전면광고)가 트리거되어
 *    페이지 네비게이션을 가로챌 수 있으므로, slot은 필수입니다.
 *    자동 광고(Auto Ads)는 head의 adsbygoogle 스크립트만으로 작동합니다.
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

  // slot이 없으면 자동 광고에 맡김 (빈 placeholder)
  if (!slot) {
    return null;
  }

  return (
    <div className={`ad-slot w-full overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
