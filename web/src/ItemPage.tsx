import { useState } from "react";
import { api, confirmDialog, photoUrl, type Item, type Req } from "./api";
import { askLabel, requestActions, t } from "./i18n";
import { kindEmoji, type Action } from "./strings";
import { Badge, go, useLoad } from "./ui";

export function ItemPage({ id }: { id: number }) {
  const { data: item, error, reload } = useLoad(() => api.item(id), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <p className="error">{error}</p>;
  if (!item) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog(t.deleteConfirm(item.title)))) return;
    setBusy(true);
    try {
      await api.deleteItem(item.id);
      go("/mine");
    } catch (e) {
      setActionError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <article className="item">
      {item.photos.length > 0 ? (
        <div className="photos">
          {item.photos.map((p) => (
            <img key={p} src={photoUrl(p)} alt="" />
          ))}
        </div>
      ) : (
        <div className="photo-placeholder">{kindEmoji[item.kind]}</div>
      )}

      <h1>{item.title}</h1>
      <div className="badges">
        <Badge>{t.kind[item.kind]}</Badge>
        <Badge tone={item.direction === "want" ? "accent" : "muted"}>{t.direction[item.direction]}</Badge>
        {item.status !== "available" && <Badge tone="warn">{t.itemStatus[item.status]}</Badge>}
      </div>

      {item.description && <p className="description">{item.description}</p>}

      <dl className="facts">
        <dt>{item.direction === "want" ? t.seeker : t.owner}</dt>
        <dd>
          {item.isOwner ? t.you : item.owner.username ? <a href={`https://t.me/${item.owner.username}`}>{item.owner.name}</a> : item.owner.name}
        </dd>
        {item.circles.length > 0 && (
          <>
            <dt>{t.circles}</dt>
            <dd>{item.circles.map((c) => c.title).join(", ")}</dd>
          </>
        )}
        {item.holder && (
          <>
            <dt>{item.holder.status === "handed" ? t.heldBy : t.promisedTo}</dt>
            <dd>
              {item.holder.name}
              {item.holder.dueDate && t.until(t.date(item.holder.dueDate))}
            </dd>
          </>
        )}
      </dl>

      {actionError && <p className="error">{actionError}</p>}

      {item.isOwner ? (
        <OwnerPanel item={item} busy={busy} onAction={(reqId, action) => run(() => api.act(reqId, action))} onDelete={remove} />
      ) : (
        <VisitorPanel item={item} busy={busy} run={run} />
      )}
    </article>
  );
}

function RequestButtons(props: { req: Req; role: "owner" | "requester"; lendable: boolean; busy: boolean; onAction: (a: Action) => void }) {
  const actions = requestActions(props.req.status, props.role, props.lendable);
  if (actions.length === 0) return null;
  return (
    <div className="actions">
      {actions.map((a) => (
        <button key={a.action} className={a.primary ? "btn primary" : "btn"} disabled={props.busy} onClick={() => props.onAction(a.action)}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

function OwnerPanel(props: { item: Item; busy: boolean; onAction: (reqId: number, a: Action) => void; onDelete: () => void }) {
  const { item } = props;
  return (
    <>
      {item.status === "draft" && <p className="notice">{t.draftNotice}</p>}
      {item.requests.length > 0 && (
        <section>
          <h2>{t.requests}</h2>
          {item.requests.map((r) => (
            <div key={r.id} className="request">
              <div className="request-head">
                <strong>{r.username ? <a href={`https://t.me/${r.username}`}>{r.name}</a> : r.name}</strong>
                <Badge tone={r.status === "pending" ? "accent" : "muted"}>{t.reqStatus[r.status]}</Badge>
              </div>
              {r.message && <p>«{r.message}»</p>}
              {r.dueDate && <p className="hint">{t.returnsBy(t.date(r.dueDate))}</p>}
              <RequestButtons req={r} role="owner" lendable={item.lendable} busy={props.busy} onAction={(a) => props.onAction(r.id, a)} />
            </div>
          ))}
        </section>
      )}
      <div className="actions">
        <a className="btn" href={`#/edit/${item.id}`}>
          {t.edit}
        </a>
        <button className="btn danger" disabled={props.busy} onClick={props.onDelete}>
          {t.delete}
        </button>
      </div>
    </>
  );
}

function VisitorPanel(props: { item: Item; busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const { item } = props;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState("");

  if (item.myRequest) {
    const r = item.myRequest;
    const text =
      r.status === "pending"
        ? t.requestSent
        : r.status === "accepted"
          ? t.requestAccepted
          : t.withYou(r.dueDate ? t.date(r.dueDate) : null);
    return (
      <section>
        <p className="notice">{text}</p>
        <div className="actions">
          {r.status !== "pending" && item.owner.username && (
            <a className="btn primary" href={`https://t.me/${item.owner.username}`}>
              {t.messageTo(item.owner.name)}
            </a>
          )}
        </div>
        <RequestButtons req={r} role="requester" lendable={item.lendable} busy={props.busy} onAction={(a) => props.run(() => api.act(r.id, a))} />
      </section>
    );
  }

  if (item.status !== "available") return <p className="notice">{t.busyNotice}</p>;

  if (!open) {
    return (
      <div className="actions">
        <button className="btn primary wide" onClick={() => setOpen(true)}>
          {askLabel(item)}
        </button>
      </div>
    );
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        props.run(() => api.ask(item.id, message, dueDate || null));
      }}
    >
      <label>
        {t.message}
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} placeholder={t.messagePlaceholder} />
      </label>
      {item.lendable && (
        <label>
          {t.returnBy}
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </label>
      )}
      <div className="actions">
        <button className="btn primary" disabled={props.busy}>
          {t.sendRequest}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
