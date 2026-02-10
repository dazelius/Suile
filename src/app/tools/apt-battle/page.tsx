import type { Metadata } from "next";
import { Suspense } from "react";
import AptBattleClient from "./AptBattleClient";

export const metadata: Metadata = {
  title: "아파트 배틀 - 전국 부동산 실거래가 비교",
  description:
    "전국 아파트 실거래가로 평당가 상승률 대결! 우리 동네 아파트 vs 그 동네 아파트, 어디가 더 올랐을까?",
  keywords: [
    "아파트 배틀",
    "부동산 비교",
    "실거래가",
    "평당가",
    "아파트 가격 비교",
    "부동산 시세",
    "래미안 vs 자이",
    "강남 아파트",
  ],
};

export default function AptBattlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-muted-foreground text-sm">
          로딩중...
        </div>
      }
    >
      <AptBattleClient />
    </Suspense>
  );
}
