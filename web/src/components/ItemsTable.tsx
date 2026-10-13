"use client";
import { Item } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function StatusBadge({ status }: { status: Item["status"] }) {
  const { t } = useI18n();
  const mark = status === "found" ? "✓ " : status === "missing" ? "✕ " : "+ ";
  return <span className={`badge ${status}`}>{mark + t(`status.${status}`)}</span>;
}

export function ConditionBadge({ condition }: { condition: Item["condition"] }) {
  const { t } = useI18n();
  if (!condition) return <span className="muted">–</span>;
  return <span className={`badge cond-${condition}`}>{t(`cond.${condition}`)}</span>;
}

export function ItemsTable({ items, token, showPhoto = true }: { items: Item[]; token?: string; showPhoto?: boolean }) {
  const { t, locale } = useI18n();
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "–");
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{t("col.tag")}</th>
            <th scope="col">{t("col.description")}</th>
            <th scope="col">{t("col.status")}</th>
            <th scope="col">{t("col.condition")}</th>
            <th scope="col">{t("col.room")}</th>
            <th scope="col">{t("col.checkedBy")}</th>
            <th scope="col">{t("col.time")}</th>
            <th scope="col">{t("col.notes")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.tagNumber}>
              <td className="tag">{it.tagNumber}</td>
              <td>{it.description || "–"}</td>
              <td>
                <StatusBadge status={it.status} />
              </td>
              <td>
                <ConditionBadge condition={it.condition} />
                {it.conflict && (
                  <div title={t("conflict.flag")}>
                    <small className="badge cond-needs_repair">⚠ {t("conflict.flag")}</small>
                  </div>
                )}
              </td>
              <td>{it.room || "–"}</td>
              <td>{it.checkedBy || "–"}</td>
              <td>{fmt(it.checkedAt)}</td>
              <td>
                {it.notes}
                {showPhoto && token && it.photoId && (
                  <>
                    {it.notes ? " " : ""}
                    <a href={`/api/v1/photos/${it.photoId}?token=${token}`} target="_blank" rel="noreferrer">
                      {t("dash.photo")}
                    </a>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
