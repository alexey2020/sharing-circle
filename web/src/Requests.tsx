import { useState } from "react";
import { api, type ReqRow } from "./api";
import { requestActions, t } from "./i18n";
import type { Action } from "./strings";
import { Badge, Empty, useLoad } from "./ui";

const ACTIVE = ["pending", "accepted", "handed"];

export function Requests() {
  const { data, error, reload } = useLoad(() => api.requests(), []);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (id: number, action: Action) => {
    setBusy(true);
    setActionError(null);
    try {
      await api.act(id, action);
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const section = (title: string, rows: ReqRow[], role: "owner" | "requester") =>
    rows.length > 0 && (
      <section>
        <h2>{title}</h2>
        {rows.map((r) => (
          <div key={r.id} className={ACTIVE.includes(r.status) ? "request" : "request past"}>
            <div className="request-head">
              <a href={`#/item/${r.itemId}`}>
                <strong>{r.title}</strong>
              </a>
              <Badge tone={r.status === "pending" ? "accent" : "muted"}>{t.reqStatus[r.status]}</Badge>
            </div>
            <p className="hint">
              {r.person.username ? <a href={`https://t.me/${r.person.username}`}>{r.person.name}</a> : r.person.name}
              {r.dueDate && ` · ${t.date(r.dueDate)}`}
            </p>
            {r.message && <p>«{r.message}»</p>}
            <div className="actions">
              {requestActions(r.status, role, r.lendable).map((a) => (
                <button key={a.action} className={a.primary ? "btn primary" : "btn"} disabled={busy} onClick={() => act(r.id, a.action)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    );

  return (
    <>
      <h1>{t.tabs.requests}</h1>
      {actionError && <p className="error">{actionError}</p>}
      {data.incoming.length === 0 && data.outgoing.length === 0 && (
        <Empty title={t.requestsEmpty}>
          <p>{t.requestsEmptyHint}</p>
        </Empty>
      )}
      {section(t.incoming, data.incoming, "owner")}
      {section(t.outgoing, data.outgoing, "requester")}
    </>
  );
}
