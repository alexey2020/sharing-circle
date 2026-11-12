import { displayName } from "./db";
import type { ErrKey } from "./i18n";
import { isLendable, nextStatus, type Action, type ReqStatus, type Role } from "./flow";
import { notifyRequestChange } from "./notify";
import type { Direction, Env, Kind } from "./types";

export type ActionResult = { ok: true; status: ReqStatus } | { ok: false; code: 403 | 404 | 409; error: ErrKey };

interface Row {
  id: number;
  item_id: number;
  requester_id: number;
  status: ReqStatus;
  due_date: string | null;
  owner_id: number;
  kind: Kind;
  direction: Direction;
  title: string;
}

/** Единая точка смены статуса запроса: ею пользуются и API, и кнопки бота. */
export async function applyAction(env: Env, requestId: number, actorId: number, action: Action): Promise<ActionResult> {
  const db = env.DB;
  const r = await db
    .prepare(
      `SELECT r.id, r.item_id, r.requester_id, r.status, r.due_date, i.owner_id, i.kind, i.direction, i.title
       FROM requests r JOIN items i ON i.id = r.item_id WHERE r.id = ?1`,
    )
    .bind(requestId)
    .first<Row>();
  if (!r) return { ok: false, code: 404, error: "reqNotFound" };

  const role: Role | null = actorId === r.owner_id ? "owner" : actorId === r.requester_id ? "requester" : null;
  if (!role) return { ok: false, code: 403, error: "notYours" };

  const lendable = isLendable(r);
  const next = nextStatus(r.status, action, role, lendable);
  if (!next) return { ok: false, code: 409, error: "notNow" };

  if (lendable && action === "accept") {
    const taken = await db
      .prepare(`SELECT 1 AS x FROM requests WHERE item_id = ?1 AND id <> ?2 AND status IN ('accepted','handed')`)
      .bind(r.item_id, r.id)
      .first();
    if (taken) return { ok: false, code: 409, error: "promised" };
  }

  const stmts = [
    db.prepare(`UPDATE requests SET status = ?1, updated_at = datetime('now') WHERE id = ?2`).bind(next, r.id),
    db
      .prepare(`INSERT INTO events (item_id, request_id, actor_id, type) VALUES (?1, ?2, ?3, ?4)`)
      .bind(r.item_id, r.id, actorId, `request_${next}`),
  ];
  if (lendable) {
    if (next === "accepted" || next === "handed") {
      stmts.push(db.prepare(`UPDATE items SET status = 'busy' WHERE id = ?1 AND status = 'available'`).bind(r.item_id));
    } else if (r.status === "accepted" || r.status === "handed") {
      stmts.push(db.prepare(`UPDATE items SET status = 'available' WHERE id = ?1 AND status = 'busy'`).bind(r.item_id));
    }
  }
  // «Ищу» выполнено — объявление больше не нужно в каталоге. Владелец может снова включить его в редактировании.
  if (r.direction === "want" && next === "done") {
    stmts.push(db.prepare(`UPDATE items SET status = 'hidden' WHERE id = ?1 AND status = 'available'`).bind(r.item_id));
  }
  await db.batch(stmts);

  const actor = await db
    .prepare(`SELECT first_name, last_name, username FROM users WHERE id = ?1`)
    .bind(actorId)
    .first<{ first_name: string; last_name: string | null; username: string | null }>();
  await notifyRequestChange(env, { ...r, id: r.item_id }, next, {
    id: actorId,
    name: actor ? displayName(actor) : "—",
    username: actor?.username ?? null,
  });

  return { ok: true, status: next };
}
