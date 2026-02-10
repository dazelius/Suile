"use client";

import { useI18n, LOCALES } from "./I18nProvider";

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => {
        const next = locale === "ko" ? "en" : "ko";
        setLocale(next);
      }}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-accent transition-colors active:scale-95"
      aria-label="Switch language"
    >
      <span>{LOCALES.find((l) => l.code === locale)?.flag}</span>
      <span className="hidden sm:inline">
        {locale === "ko" ? "EN" : "KO"}
      </span>
    </button>
  );
}
