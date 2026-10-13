"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, errorKey } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { setLeader } from "@/lib/session";

export default function NewSurvey() {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ surveyId: string; leaderToken: string }>("/surveys", { body: { name, building } });
      setLeader(r.surveyId, r.leaderToken, name.trim());
      router.push(`/survey/${r.surveyId}`);
    } catch (err) {
      setError(errorKey(err));
      setBusy(false);
    }
  }

  return (
    <form className="narrow card" onSubmit={submit}>
      <h1>{t("survey.newTitle")}</h1>
      <label htmlFor="name">{t("survey.name")}</label>
      <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      <label htmlFor="building">{t("survey.building")}</label>
      <input id="building" type="text" value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={200} />
      {error && (
        <div className="error" role="alert">
          {t(error)}
        </div>
      )}
      <p />
      <button className="btn block" disabled={busy || !name.trim()}>
        {busy ? t("survey.creating") : t("survey.create")}
      </button>
    </form>
  );
}
