"use client";
import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Condition, CONDITIONS } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { compressImage, enqueue, listQueue, removeFromQueue, syncQueue } from "@/lib/offline";
import { getMember, getRoom, MemberSession, newId, setRoom as saveRoom } from "@/lib/session";

interface Scanner {
  start: (...args: unknown[]) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => void;
}

export default function Scan() {
  const { t } = useI18n();
  const [member, setMember] = useState<MemberSession | null | undefined>(undefined);
  const [tag, setTag] = useState("");
  const [typed, setTyped] = useState("");
  const [condition, setCondition] = useState<Condition | null>(null);
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [recent, setRecent] = useState<{ tag: string; condition: Condition }[]>([]);
  const [camError, setCamError] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const scanner = useRef<Scanner | null>(null);
  const camOps = useRef<Promise<void>>(Promise.resolve());
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMember(getMember());
    setRoom(getRoom());
    setOnline(navigator.onLine);
  }, []);

  const refreshQueue = useCallback(async () => {
    try {
      const q = await listQueue();
      setPending(q.filter((x) => !x.error).length);
      setFailed(q.filter((x) => x.error).length);
    } catch {}
  }, []);

  const sync = useCallback(async () => {
    if (!member) return;
    const r = await syncQueue(member.memberToken);
    if (r.offline) setOnline(false);
    else setOnline(true);
    if (r.unauthorized) setErr("err.unauthorized");
    await refreshQueue();
  }, [member, refreshQueue]);

  // Send whatever is waiting: on load, when the connection returns, and every 15 s while something is waiting.
  useEffect(() => {
    if (!member) return;
    refreshQueue().then(sync);
    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [member, sync, refreshQueue]);

  useEffect(() => {
    if (!member || pending === 0) return;
    const i = setInterval(sync, 15000);
    return () => clearInterval(i);
  }, [member, pending, sync]);

  // ---- camera (calls are queued one after another so start/stop never overlap) ----
  const startCamera = useCallback(() => {
    camOps.current = camOps.current.then(async () => {
      if (scanner.current) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const s = new Html5Qrcode("reader") as unknown as Scanner;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text: string) => {
            const v = text.trim();
            if (v) setTag(v.toUpperCase());
          },
          () => {},
        );
        scanner.current = s;
        setCamError(false);
      } catch {
        scanner.current = null;
        setCamError(true);
      }
    });
  }, []);

  const stopCamera = useCallback(() => {
    camOps.current = camOps.current.then(async () => {
      const s = scanner.current;
      scanner.current = null;
      if (s) {
        try {
          await s.stop();
          s.clear();
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    if (!member) return;
    if (tag) {
      stopCamera();
      return;
    }
    startCamera();
    return () => stopCamera();
  }, [member, tag, startCamera, stopCamera]);

  // ---- recording ----
  function reset() {
    setTag("");
    setTyped("");
    setCondition(null);
    setNotes("");
    setPhoto(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl("");
  }

  function useTyped(e: FormEvent) {
    e.preventDefault();
    const v = typed.trim().toUpperCase();
    if (v) {
      setMsg("");
      setTag(v);
    }
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const blob = await compressImage(f);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(blob);
    setPhotoUrl(URL.createObjectURL(blob));
  }

  async function save() {
    if (!member || !tag || !condition) return;
    setErr("");
    try {
      await enqueue({
        id: newId(),
        tagNumber: tag,
        condition,
        notes: notes.trim(),
        room: room.trim(),
        scannedAt: new Date().toISOString(),
        photo: photo || undefined,
        photoId: photo ? newId() : undefined,
      });
    } catch {
      setErr("err.generic");
      return;
    }
    saveRoom(room.trim());
    setRecent((r) => [{ tag, condition }, ...r].slice(0, 6));
    setMsg(t("scan.saved", { tag }));
    reset();
    await refreshQueue();
    sync();
  }

  async function discardFailed() {
    for (const q of await listQueue()) if (q.error) await removeFromQueue(q.id);
    refreshQueue();
  }

  if (member === undefined) return <p>{t("common.loading")}</p>;
  if (member === null)
    return (
      <div className="narrow card">
        <p>{t("scan.noSession")}</p>
        <Link href="/" className="btn secondary">
          {t("common.back")}
        </Link>
      </div>
    );

  return (
    <div className="narrow">
      <div className="scan-status">
        <span className={`pill ${online ? "" : "off"}`}>
          <span className="dot" aria-hidden="true" />
          {online ? t("scan.online") : t("scan.offlineShort")}
        </span>
        <span aria-live="polite">{pending > 0 ? t("scan.pending", { n: pending }) : t("scan.allSent")}</span>
        {pending > 0 && online && (
          <button className="btn secondary" style={{ minHeight: 44 }} onClick={sync}>
            {t("scan.syncNow")}
          </button>
        )}
      </div>

      {!online && <div className="notice">{t("scan.offline")}</div>}
      {failed > 0 && (
        <div className="error" role="alert">
          {t("scan.failed", { n: failed })}{" "}
          <button className="btn secondary" style={{ minHeight: 40 }} onClick={discardFailed}>
            {t("scan.discard")}
          </button>
        </div>
      )}
      {msg && (
        <div className="success" role="status">
          {msg}
        </div>
      )}
      {err && (
        <div className="error" role="alert">
          {t(err)}
        </div>
      )}

      <section className="card" style={{ marginTop: "1rem" }}>
        <div style={{ display: tag ? "none" : "block" }}>
          <h1>{t("scan.title")}</h1>
          <p className="muted">{member.surveyName}</p>
          <div id="reader" />
          {!camError && <p className="muted">{t("scan.cameraHelp")}</p>}
          {camError && (
            <div className="notice">
              {t("scan.cameraError")}{" "}
              <button className="btn secondary" style={{ minHeight: 40 }} onClick={startCamera}>
                {t("scan.startCamera")}
              </button>
            </div>
          )}
          <form onSubmit={useTyped}>
            <label htmlFor="typed">{t("scan.typeLabel")}</label>
            <div className="field-row">
              <input
                id="typed"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={t("scan.tagPlaceholder")}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
              />
              <button className="btn" disabled={!typed.trim()}>
                {t("scan.use")}
              </button>
            </div>
          </form>
        </div>

        {tag && (
          <div>
            <div className="tag-big">{tag}</div>
            <h2 style={{ marginTop: ".75rem" }} id="cond-label">
              {t("scan.condition")}
            </h2>
            <div className="conditions" role="group" aria-labelledby="cond-label">
              {CONDITIONS.map((c) => (
                <button key={c} type="button" className="cond" aria-pressed={condition === c} onClick={() => setCondition(c)}>
                  {t(`cond.${c}`)}
                </button>
              ))}
            </div>

            <label htmlFor="room">{t("scan.room")}</label>
            <input id="room" type="text" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={100} />
            <label htmlFor="notes">{t("scan.notes")}</label>
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />

            <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="sr-only" tabIndex={-1} aria-hidden="true" />
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="photo-preview" src={photoUrl} alt="" />
            )}
            <div className="btn-row" style={{ margin: ".75rem 0" }}>
              <button type="button" className="btn secondary" onClick={() => fileInput.current?.click()}>
                {photo ? t("scan.retake") : t("scan.addPhoto")}
              </button>
              {photo && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoUrl("");
                  }}
                >
                  {t("scan.removePhoto")}
                </button>
              )}
            </div>

            <div className="btn-row">
              <button className="btn" style={{ flex: 1 }} disabled={!condition} onClick={save}>
                {t("scan.save")}
              </button>
              <button className="btn secondary" onClick={reset}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="card">
          <h2>{t("scan.recent")}</h2>
          <ul className="recent">
            {recent.map((r, i) => (
              <li key={i}>
                <strong>{r.tag}</strong>
                <span>{t(`cond.${r.condition}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
