"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ItemsTable } from "@/components/ItemsTable";
import { api, countItems, errorKey, Item, Member } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getLeaderToken } from "@/lib/session";

interface SurveyInfo {
  surveyId: string;
  name: string;
  building: string;
  joinToken: string;
  joinExpiresAt: string;
  members: Member[];
}
type Filter = "all" | "found" | "missing" | "extra" | "attention" | "conflicts";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Dashboard({ params }: { params: { id: string } }) {
  const { t } = useI18n();
  const id = params.id;
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [survey, setSurvey] = useState<SurveyInfo | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const [origin, setOrigin] = useState("");
  const [isLocal, setIsLocal] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setToken(getLeaderToken(id));
    setOrigin(window.location.origin);
    setIsLocal(["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [id]);

  const loadSurvey = useCallback(async () => {
    if (!token) return;
    try {
      setSurvey(await api<SurveyInfo>(`/surveys/${id}`, { token }));
    } catch (e) {
      setError(errorKey(e));
    }
  }, [id, token]);

  const loadItems = useCallback(async () => {
    if (!token) return;
    try {
      setItems((await api<{ items: Item[] }>(`/surveys/${id}/items`, { token })).items);
    } catch (e) {
      setError(errorKey(e));
    }
  }, [id, token]);

  useEffect(() => {
    loadSurvey();
    loadItems();
  }, [loadSurvey, loadItems]);

  // Live updates. If the connection drops the browser reconnects by itself, and we re-read the list when it does.
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`/api/v1/surveys/${id}/live?token=${token}`);
    const refreshMembers = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(loadSurvey, 800);
    };
    es.onopen = () => {
      setLive(true);
      loadItems();
    };
    es.onerror = () => setLive(false);
    es.onmessage = (ev) => {
      let m: { type: string; item?: Item };
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.type === "scan.recorded" && m.item) {
        const it = m.item;
        setItems((prev) => {
          const i = prev.findIndex((p) => p.tagNumber === it.tagNumber);
          if (i >= 0) return prev.map((p, j) => (j === i ? it : p));
          return [...prev, it].sort((a, b) => a.tagNumber.localeCompare(b.tagNumber));
        });
        refreshMembers();
      } else if (m.type === "member.joined") refreshMembers();
      else if (m.type === "assets.imported") loadItems();
    };
    return () => es.close();
  }, [id, token, loadItems, loadSurvey]);

  const counts = useMemo(() => countItems(items), [items]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "found" || filter === "missing" || filter === "extra") if (it.status !== filter) return false;
      if (filter === "attention" && !(it.condition === "needs_repair" || it.condition === "unserviceable" || it.condition === "missing")) return false;
      if (filter === "conflicts" && !it.conflict) return false;
      return !q || it.tagNumber.toLowerCase().includes(q) || it.description.toLowerCase().includes(q);
    });
  }, [items, filter, query]);

  async function newQr() {
    if (!token) return;
    try {
      const r = await api<{ joinToken: string; joinExpiresAt: string }>(`/surveys/${id}/join-token`, { method: "POST", token, body: {} });
      setSurvey((s) => (s ? { ...s, ...r } : s));
    } catch (e) {
      setError(errorKey(e));
    }
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setError("");
    setInfo("");
    try {
      const r = await api<{ imported: number }>(`/surveys/${id}/assets`, { token, raw: await file.text(), contentType: "text/csv" });
      setInfo(t("dash.importDone", { n: r.imported }));
      loadItems();
    } catch (err) {
      setError(errorKey(err));
    }
  }

  async function exportCsv() {
    if (!token) return;
    try {
      const blob = await api<Blob>(`/surveys/${id}/export.csv`, { token });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tallytag-results.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(errorKey(err));
    }
  }

  if (token === undefined) return <p>{t("common.loading")}</p>;
  if (token === null) return <div className="notice">{t("dash.noLeader")}</div>;

  const remaining = survey ? new Date(survey.joinExpiresAt).getTime() - now : 0;
  const expired = !!survey && remaining <= 0;
  const filters: [Filter, string, number][] = [
    ["all", t("filter.all"), counts.total],
    ["found", t("counts.found"), counts.found],
    ["missing", t("counts.missing"), counts.missing],
    ["extra", t("counts.extra"), counts.extra],
    ["attention", t("counts.attention"), counts.needsAttention],
    ["conflicts", t("counts.conflicts"), counts.conflicts],
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>{survey?.name}</h1>
          <p className="muted">{survey?.building}</p>
        </div>
        <span className={`pill ${live ? "" : "off"}`} role="status">
          <span className="dot" aria-hidden="true" />
          {live ? t("dash.live") : t("dash.reconnecting")}
        </span>
      </div>

      {error && (
        <div className="error" role="alert">
          {t(error)}
        </div>
      )}
      {info && (
        <div className="success" role="status">
          {info}
        </div>
      )}

      <div className="counts" aria-live="polite">
        <div className="count found">
          <b>{counts.found}</b>
          {t("counts.found")}
        </div>
        <div className="count missing">
          <b>{counts.missing}</b>
          {t("counts.missing")}
        </div>
        <div className="count extra">
          <b>{counts.extra}</b>
          {t("counts.extra")}
        </div>
        <div className="count attention">
          <b>{counts.needsAttention}</b>
          {t("counts.attention")}
        </div>
      </div>

      <div className="dash">
        <aside>
          <section className="card">
            <h2>{t("dash.joinTitle")}</h2>
            {survey && (
              <>
                <div className="qr" style={{ opacity: expired ? 0.3 : 1 }}>
                  <QRCodeSVG value={`${origin}/join/${survey.joinToken}`} size={220} level="M" />
                </div>
                <p className="muted" style={{ marginTop: ".5rem" }}>
                  {expired ? t("dash.expired") : t("dash.expiresIn", { time: mmss(remaining) })}
                </p>
                <p>{t("dash.scanToJoin")}</p>
                {isLocal && <div className="notice">{t("dash.localhostWarn")}</div>}
                <button className="btn secondary block" onClick={newQr}>
                  {t("dash.newQr")}
                </button>
              </>
            )}
          </section>

          <section className="card">
            <h2>{t("dash.team")}</h2>
            {survey && survey.members.length === 0 && <p className="muted">{t("dash.noMembers")}</p>}
            <ul className="members">
              {survey?.members.map((m) => (
                <li key={m.memberId}>
                  <span>{m.name}</span>
                  <span className="muted">{t("dash.checks", { n: m.checks })}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack">
            <label className="btn secondary block" style={{ margin: 0 }}>
              {t("dash.import")}
              <input type="file" accept=".csv,text/csv" onChange={onImport} className="sr-only" />
            </label>
            <small className="muted">{t("dash.importHint")}</small>
            <button className="btn secondary block" onClick={exportCsv}>
              {t("dash.export")}
            </button>
            <Link className="btn block" href={`/survey/${id}/report`}>
              {t("dash.report")}
            </Link>
          </section>
        </aside>

        <section>
          <label htmlFor="q" className="sr-only">
            {t("dash.search")}
          </label>
          <input id="q" type="search" placeholder={t("dash.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="tabs" role="group">
            {filters.map(([key, label, n]) => (
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label} ({n})
              </button>
            ))}
          </div>
          {shown.length === 0 ? <p className="muted">{t("dash.empty")}</p> : <ItemsTable items={shown} token={token} />}
        </section>
      </div>
    </div>
  );
}
