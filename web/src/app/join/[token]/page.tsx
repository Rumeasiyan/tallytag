"use client";
import { FormEvent, useEffect, useState } from "react";
import { api, errorKey } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getMember, setMember } from "@/lib/session";

export default function Join({ params }: { params: { token: string } }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(getMember()?.name || "");
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ memberId: string; memberToken: string; surveyId: string; surveyName: string }>("/join", {
        body: { joinToken: params.token, name },
      });
      setMember({ ...r, name: name.trim() });
      // A full page load (not a client-side jump) lets the service worker keep the scan screen for offline use.
      window.location.href = "/scan";
    } catch (err) {
      setError(errorKey(err));
      setBusy(false);
    }
  }

  return (
    <form className="narrow card" onSubmit={submit}>
      <h1>{t("join.title")}</h1>
      <label htmlFor="name">{t("join.name")}</label>
      <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
      {error && (
        <div className="error" role="alert">
          {t(error)}
        </div>
      )}
      <p />
      <button className="btn block" disabled={busy || !name.trim()}>
        {busy ? t("join.joining") : t("join.button")}
      </button>
    </form>
  );
}
