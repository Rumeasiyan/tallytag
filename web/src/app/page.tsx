"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getMember, listLeaderSurveys, MemberSession } from "@/lib/session";

export default function Home() {
  const { t } = useI18n();
  const [member, setMember] = useState<MemberSession | null>(null);
  const [surveys, setSurveys] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    setMember(getMember());
    setSurveys(listLeaderSurveys());
  }, []);

  return (
    <div className="narrow">
      <section className="hero">
        <h1>{t("app.tagline")}</h1>
      </section>
      <div className="stack">
        <Link href="/survey/new" className="btn block">
          {t("home.start")}
        </Link>
        {member && (
          <Link href="/scan" className="btn block secondary">
            {t("home.continue")} ({member.surveyName})
          </Link>
        )}
        {surveys.map((s) => (
          <Link key={s.id} href={`/survey/${s.id}`} className="btn block secondary">
            {t("home.openSurvey", { name: s.name })}
          </Link>
        ))}
        <Link href="/labels" className="btn block secondary">
          {t("home.labels")}
        </Link>
      </div>
      <p className="muted" style={{ marginTop: "1.25rem" }}>
        {t("home.joinHint")}
      </p>
    </div>
  );
}
