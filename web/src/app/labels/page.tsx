"use client";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function Labels() {
  const { t } = useI18n();
  const [heading, setHeading] = useState("TEST TAG");
  const [prefix, setPrefix] = useState("TEST-");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(12);
  const count = Math.max(0, Math.min(200, to - from + 1));
  const tags = Array.from({ length: count }, (_, i) => `${prefix}${String(from + i).padStart(4, "0")}`);

  return (
    <div>
      <div className="card no-print">
        <h1>{t("labels.title")}</h1>
        <label htmlFor="h">{t("labels.heading")}</label>
        <input id="h" type="text" value={heading} onChange={(e) => setHeading(e.target.value)} />
        <label htmlFor="p">{t("labels.prefix")}</label>
        <input id="p" type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        <div className="field-row">
          <div>
            <label htmlFor="f">{t("labels.from")}</label>
            <input id="f" type="number" min={0} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="to">{t("labels.to")}</label>
            <input id="to" type="number" min={0} value={to} onChange={(e) => setTo(Number(e.target.value))} />
          </div>
        </div>
        <p />
        <button className="btn" onClick={() => window.print()}>
          {t("common.print")}
        </button>
      </div>
      <div className="label-grid">
        {tags.map((tag) => (
          <div className="label" key={tag}>
            <strong>{heading}</strong>
            <QRCodeSVG value={tag} size={110} level="M" />
            <span>{tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
