"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LetterView } from "./LetterView";

function MessageContent() {
  const searchParams = useSearchParams();
  const [encoded, setEncoded] = useState<string | null>(null);

  useEffect(() => {
    const d = searchParams.get("d");
    if (d) {
      setEncoded(decodeURIComponent(d));
    }
  }, [searchParams]);

  if (!encoded) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-transparent" />
      </div>
    );
  }

  return <LetterView encoded={encoded} />;
}

export function MessageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-transparent" />
        </div>
      }
    >
      <MessageContent />
    </Suspense>
  );
}
