"use client";

import { useState, useEffect } from "react";
import { getLogoUrls, getTickerColor } from "./stock-logos";

interface StockLogoProps {
  ticker: string;
  name: string;
  size?: number;
  className?: string;
}

/**
 * 종목 로고 컴포넌트
 * 여러 소스를 순차적으로 시도, 전부 실패 시 컬러 이니셜 아바타 표시
 */
export function StockLogo({ ticker, name, size = 40, className = "" }: StockLogoProps) {
  const urls = getLogoUrls(ticker);
  const [srcIndex, setSrcIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(urls.length === 0);

  // ticker가 바뀌면 리셋
  useEffect(() => {
    const newUrls = getLogoUrls(ticker);
    setSrcIndex(0);
    setAllFailed(newUrls.length === 0);
  }, [ticker]);

  const handleError = () => {
    if (srcIndex < urls.length - 1) {
      setSrcIndex((i) => i + 1);
    } else {
      setAllFailed(true);
    }
  };

  if (allFailed) {
    const color = getTickerColor(ticker);
    const initial = name.charAt(0).toUpperCase();
    return (
      <div
        className={`flex items-center justify-center rounded-xl text-white font-bold shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.38,
          backgroundColor: color,
        }}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={urls[srcIndex]}
      alt={name}
      width={size}
      height={size}
      className={`rounded-xl bg-white object-contain shrink-0 ${className}`}
      style={{ width: size, height: size }}
      onError={handleError}
      referrerPolicy="no-referrer"
    />
  );
}
