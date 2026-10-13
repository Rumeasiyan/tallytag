"use client";
import Link from "next/link";
import { useEffect } from "react";
import { LANGUAGES, Lang, useI18n } from "@/lib/i18n";
import { Logo } from "./Logo";

export function Shell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          <Logo />
          <span>{t("app.name")}</span>
        </Link>
        <div className="langs" role="group" aria-label={t("lang.label")}>
          {(Object.keys(LANGUAGES) as Lang[]).map((l) => (
            <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
              {LANGUAGES[l].label}
            </button>
          ))}
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
