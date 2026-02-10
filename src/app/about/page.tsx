import type { Metadata } from "next";
import Link from "next/link";
import { Wrench, Zap, Heart, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "소개",
  description: "SUILE - 당신의 일상을 편리하게 만드는 무료 온라인 도구 모음",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">SUILE</h1>
      <p className="text-muted-foreground mb-10">
        당신의 일상을 편리하게 만드는 무료 온라인 도구 모음
      </p>

      {/* 핵심 가치 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-12">
        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">빠르고 간편하게</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              회원가입 없이 바로 사용. 필요한 도구를 열고 즉시 결과를 얻으세요.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">완전 무료</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              모든 도구를 무료로 제공합니다. 숨겨진 비용이나 제한 없이
              자유롭게 사용하세요.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">개인정보 보호</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              데이터를 서버에 저장하지 않습니다. 여러분의 콘텐츠는 여러분의
              기기에만 존재합니다.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">계속 성장하는 도구</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              새로운 도구가 지속적으로 추가됩니다. 더 많은 도구로 일상의
              불편함을 해결해 드리겠습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 서비스 소개 */}
      <section className="space-y-4 text-sm text-muted-foreground mb-12">
        <h2 className="text-lg font-semibold text-foreground">
          SUILE는 어떤 서비스인가요?
        </h2>
        <p>
          SUILE는 일상에서 자주 필요한 온라인 도구들을 모아둔 서비스입니다.
          QR코드로 비밀 메시지를 보내거나, 글자수를 세거나, 단위를 변환하는 등
          다양한 도구를 회원가입 없이 무료로 사용할 수 있습니다.
        </p>
        <p>
          복잡한 앱을 설치하거나 회원가입을 할 필요 없이, 브라우저에서 바로
          사용할 수 있도록 설계했습니다. 모바일과 데스크톱 모두에서 최적의
          경험을 제공합니다.
        </p>
      </section>

      {/* CTA */}
      <section className="rounded-xl border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          지금 바로 도구를 사용해보세요.
        </p>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          도구 모음 보기
        </Link>
      </section>

      {/* 연락처 */}
      <section className="mt-12 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground mb-3">문의</h2>
        <p>
          서비스 이용 중 문의사항이 있으시면 아래 이메일로 연락해 주세요.
        </p>
        <p className="mt-2">
          이메일:{" "}
          <a
            href="mailto:dazelius86@gmail.com"
            className="text-foreground underline"
          >
            dazelius86@gmail.com
          </a>
        </p>
      </section>
    </div>
  );
}
