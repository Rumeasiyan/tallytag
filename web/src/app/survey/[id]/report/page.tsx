"use client";
import { useEffect, useState } from "react";
import { ItemsTable } from "@/components/ItemsTable";
import { api, Counts, errorKey, Item, Member } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getLeaderToken } from "@/lib/session";

interface Report {
  survey: { id: string; name: string; building: string; createdAt: string };
  generatedAt: string;
  counts: Counts;
  items: Item[];
  members: Member[];
}

export default function ReportPage({ params }: { params: { id: string } }) {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<Report | null>(null);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    const tok = getLeaderToken(params.id);
    setToken(tok);
    if (!tok) return;
    api<Report>(`/surveys/${params.id}/report`, { token: tok })
      .then(setReport)
      .catch((e) => setError(errorKey(e)));
  }, [params.id]);

  if (token === undefined) return <p>{t("common.loading")}</p>;
  if (token === null) return <div className="notice">{t("dash.noLeader")}</div>;
  if (error) return <div className="error" role="alert">{t(error)}</div>;
  if (!report) return <p>{t("common.loading")}</p>;

  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" });
  const attention = report.items.filter((i) => i.condition === "needs_repair" || i.condition === "unserviceable" || i.condition === "missing" || i.conflict);
  const missing = report.items.filter((i) => i.status === "missing");
  const extra = report.items.filter((i) => i.status === "extra");
  const c = report.counts;

  const Section = ({ title, items }: { title: string; items: Item[] }) => (
    <>
      <h2>
        {title} ({items.length})
      </h2>
      {items.length ? <ItemsTable items={items} showPhoto={false} /> : <p className="muted">{t("common.none")}</p>}
    </>
  );

  return (
    <div>
      <div className="no-print btn-row" style={{ marginBottom: "1rem" }}>
        <button className="btn" onClick={() => window.print()}>
          {t("common.print")}
        </button>
      </div>
      <article className="report">
        <h1>{t("report.title")}</h1>
        <p>
          <strong>{report.survey.name}</strong>
          <br />
          {t("report.building")}: {report.survey.building || "–"}
          <br />
          {t("report.generated")}: {fmt(report.generatedAt)}
        </p>

        <h2>{t("report.summary")}</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr><th scope="row">{t("counts.total")}</th><td>{c.total}</td></tr>
              <tr><th scope="row">{t("counts.found")}</th><td>{c.found}</td></tr>
              <tr><th scope="row">{t("counts.missing")}</th><td>{c.missing}</td></tr>
              <tr><th scope="row">{t("counts.extra")}</th><td>{c.extra}</td></tr>
              <tr><th scope="row">{t("counts.attention")}</th><td>{c.needsAttention}</td></tr>
              <tr><th scope="row">{t("counts.conflicts")}</th><td>{c.conflicts}</td></tr>
            </tbody>
          </table>
        </div>

        <h2>{t("report.team")}</h2>
        <ul>
          {report.members.map((m) => (
            <li key={m.memberId}>
              {m.name} ({t("dash.checks", { n: m.checks })})
            </li>
          ))}
        </ul>

        <Section title={t("report.missingList")} items={missing} />
        <Section title={t("report.extraList")} items={extra} />
        <Section title={t("report.attentionList")} items={attention} />
        <Section title={t("report.fullList")} items={report.items} />

        <h2>{t("report.prepared")} / {t("report.reviewed")}</h2>
        <div className="sign-grid">
          {[t("report.prepared"), t("report.reviewed")].map((who) => (
            <div className="sign-box" key={who}>
              <strong>{who}</strong>
              {[t("report.name"), t("report.designation"), t("report.signature"), t("report.date")].map((f) => (
                <div key={f} style={{ marginTop: ".8rem" }}>
                  <div className="line" />
                  <small>{f}</small>
                </div>
              ))}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
