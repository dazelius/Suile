"use client";

import Link from "next/link";
import { Wrench, Zap, Heart, Shield } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("aboutTitle")}</h1>
      <p className="text-muted-foreground mb-10">{t("aboutDesc")}</p>

      {/* 핵심 가치 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-12">
        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("aboutFastTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("aboutFastDesc")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("aboutFreeTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("aboutFreeDesc")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("aboutPrivacyTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("aboutPrivacyDesc")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 h-fit">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("aboutGrowTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("aboutGrowDesc")}</p>
          </div>
        </div>
      </div>

      {/* 서비스 소개 */}
      <section className="space-y-4 text-sm text-muted-foreground mb-12">
        <h2 className="text-lg font-semibold text-foreground">{t("aboutWhatTitle")}</h2>
        <p>{t("aboutWhatDesc1")}</p>
        <p>{t("aboutWhatDesc2")}</p>
      </section>

      {/* CTA */}
      <section className="rounded-xl border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">{t("aboutCtaText")}</p>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("aboutCtaBtn")}
        </Link>
      </section>

      {/* 연락처 */}
      <section className="mt-12 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground mb-3">{t("aboutContactTitle")}</h2>
        <p>{t("aboutContactDesc")}</p>
        <p className="mt-2">
          {t("aboutContactEmail")}:{" "}
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
