"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import en from "@/messages/en.json";
import si from "@/messages/si.json";
import ta from "@/messages/ta.json";

// To add a language: add a messages/<code>.json file and one line here.
export const LANGUAGES = {
  en: { label: "English", dict: en as Record<string, string>, locale: "en-GB" },
  si: { label: "සිංහල", dict: si as Record<string, string>, locale: "si-LK" },
  ta: { label: "தமிழ்", dict: ta as Record<string, string>, locale: "ta-LK" },
} as const;
export type Lang = keyof typeof LANGUAGES;

type Vars = Record<string, string | number>;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Vars) => string; locale: string };
const I18nContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k, locale: "en-GB" });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("tt-lang");
    } catch {}
    const guess = (saved || navigator.language || "en").slice(0, 2);
    if (guess in LANGUAGES) setLangState(guess as Lang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("tt-lang", l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      let s = LANGUAGES[lang].dict[key] ?? LANGUAGES.en.dict[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, locale: LANGUAGES[lang].locale }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
