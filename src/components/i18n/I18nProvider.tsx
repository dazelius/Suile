"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type Locale,
  type Translations,
  initLocale,
  setLocale as setI18nLocale,
  getLocale,
  t as rawT,
  LOCALES,
} from "@/lib/i18n";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Translations, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "ko",
  setLocale: () => {},
  t: rawT,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const detected = initLocale();
    setLocaleState(detected);
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setI18nLocale(newLocale);
    setLocaleState(newLocale);
    // html lang 속성 업데이트
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: keyof Translations, params?: Record<string, string>) => rawT(key, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { LOCALES };
