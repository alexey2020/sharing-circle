import { Hono, type Context } from "hono";
import { verifyInitData } from "./auth";
import { canSee, displayName, getRights, joinCircle, joinCirclesOfItem, myCircles, refreshMemberships, upsertCircle, upsertUser } from "./db";
import { asLang, tr, type Lang } from "./i18n";
import { ACTIONS, isLendable, type Action } from "./flow";
import { notifyNewItem, notifyNewRequest } from "./notify";
import { applyAction } from "./requests";
import { DIRECTIONS, KINDS, type Direction, type Env, type ItemStatus, type Kind, type TgUser } from "./types";

type Ctx = { Bindings: Env; Variables: { user: TgUser; lang: Lang; startParam?: string } };
export const api = new Hono<Ctx>();

/** Тексты ошибок на языке текущего пользователя. */
const E = (c: Context<Ctx>) => tr(c.get("lang")).err;

const PHOTO_KEY = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 6;

// Фото отдаются без авторизации (тег <img> не умеет слать заголовки),
// защита — случайное неугадываемое имя файла.
api.get("/photos/:key", async (c) => {
  const key = c.req.param("key");
  if (!PHOTO_KEY.test(key)) return c.notFound();
  const obj = await c.env.PHOTOS.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});

// Нужно лендингу, чтобы дать ссылку на бота. Имя бота и так публично.
api.get("/info", (c) =>
  c.json({ botUsername: c.env.BOT_USERNAME, adminContact: c.env.ADMIN_CONTACT || null, repoUrl: c.env.REPO_URL || null }),
);

const DEV_NAMES: Record<number, string> = { 1: "Аня", 2: "Борис", 3: "Вера" };

/** Локальная разработка: два тестовых круга, чтобы проверять видимость без Telegram. */
async function ensureDevCircles(env: Env, userId: number): Promise<void> {
  const has = await env.DB.prepare(`SELECT 1 AS x FROM memberships WHERE user_id = ?1 LIMIT 1`).bind(userId).first();
  if (has) return;
  const first = await upsertCircle(env.DB, -1, "Друзья (тест)");
  const second = await upsertCircle(env.DB, -2, "Книжный клуб (тест)");
  const ids = userId <= 2 ? [first, second] : [first];
  await env.DB.batch(
    ids.map((id) => env.DB.prepare(`INSERT OR IGNORE INTO memberships (user_id, circle_id) VALUES (?1, ?2)`).bind(userId, id)),
  );
}

api.use("*", async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const devId = Number(c.req.header("X-Dev-User"));
  let user: TgUser | null = null;

  if (header.startsWith("tma ")) {
    const data = await verifyInitData(header.slice(4), c.env.BOT_TOKEN);
    if (data) {
      user = data.user;
      c.set("startParam", data.startParam);
    }
  } else if (c.env.DEV_AUTH === "1" && Number.isInteger(devId) && devId > 0) {
    user = { id: devId, first_name: DEV_NAMES[devId] ?? `Тест ${devId}`, username: `test${devId}`, allows_write_to_pm: true };
  }
  if (!user) return c.json({ error: tr("en").err.unauthorized }, 401);

  c.set("lang", await upsertUser(c.env.DB, user));
  if (c.env.DEV_AUTH === "1" && !header.startsWith("tma ")) await ensureDevCircles(c.env, user.id);
  c.set("user", user);
  await next();
});

api.get("/me", async (c) => {
  const user = c.get("user");
  const sp = c.get("startParam") ?? "";
  let openItem: number | null = null;

  const circleMatch = /^c(\d+)$/.exec(sp);
  const itemMatch = /^i(\d+)$/.exec(sp);
  if (circleMatch) await joinCircle(c.env, user.id, Number(circleMatch[1]));
  if (itemMatch) {
    openItem = Number(itemMatch[1]);
    await joinCirclesOfItem(c.env, user.id, openItem);
  }
  await refreshMemberships(c.env, user.id);

  return c.json({
    user: { id: user.id, name: displayName(user) },
    circles: await myCircles(c.env.DB, user.id),
    botUsername: c.env.BOT_USERNAME,
    canCreate: (await getRights(c.env.DB, user.id)).canCreate,
    lang: c.get("lang"),
    openItem,
  });
});

api.put("/lang", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { lang?: unknown };
  const lang = asLang(body.lang);
  if (!lang) return c.json({ error: E(c).badData }, 400);
  await c.env.DB.prepare(`UPDATE users SET lang = ?2 WHERE id = ?1`).bind(c.get("user").id, lang).run();
  return c.json({ lang });
});

// ---------- Фото ----------

api.post("/photos", async (c) => {
  const ext = PHOTO_TYPES[(c.req.header("content-type") ?? "").split(";")[0].trim()];
  if (!ext) return c.json({ error: E(c).photoType }, 400);
  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_PHOTO_BYTES) return c.json({ error: E(c).photoSize }, 400);
  const key = `${crypto.randomUUID()}.${ext}`;
  await c.env.PHOTOS.put(key, body, { httpMetadata: { contentType: c.req.header("content-type")! } });
  return c.json({ key });
});

// ---------- Вещи ----------

interface ItemInput {
  kind: Kind;
  direction: Direction;
  title: string;
  description: string;
  status: "available" | "hidden" | "draft";
  circleIds: number[];
  photoKeys: string[];
  /** false — не сообщать о новинке в чат круга */
  announce: boolean;
}

function parseItem(body: any, allowedCircles: Set<number>, e: ReturnType<typeof tr>["err"]): ItemInput | string {
  if (!body || typeof body !== "object") return e.badData;
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!KINDS.includes(body.kind)) return e.pickKind;
  if (!DIRECTIONS.includes(body.direction)) return e.pickDirection;
  if (title.length < 1 || title.length > 100) return e.titleLen;
  if (description.length > 2000) return e.descLen;
  const status = body.status ?? "available";
  if (!["available", "hidden", "draft"].includes(status)) return e.badStatus;
  const circleIds: number[] = [...new Set((Array.isArray(body.circleIds) ? body.circleIds : []).map(Number))] as number[];
  if (circleIds.some((id) => !allowedCircles.has(id))) return e.ownCirclesOnly;
  if (status === "available" && circleIds.length === 0) return e.needCircle;
  const photoKeys: string[] = Array.isArray(body.photoKeys) ? body.photoKeys.map(String) : [];
  if (photoKeys.length > MAX_PHOTOS || photoKeys.some((k) => !PHOTO_KEY.test(k))) return e.badPhotos;
  return { kind: body.kind, direction: body.direction, title, description, status, circleIds, photoKeys, announce: body.announce !== false };
}

const searchText = (title: string, description: string) => `${title} ${description}`.toLowerCase();

async function saveRelations(db: D1Database, itemId: number, input: ItemInput): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM item_circles WHERE item_id = ?1`).bind(itemId),
    db.prepare(`DELETE FROM item_photos WHERE item_id = ?1`).bind(itemId),
    ...input.circleIds.map((id) => db.prepare(`INSERT INTO item_circles (item_id, circle_id) VALUES (?1, ?2)`).bind(itemId, id)),
    ...input.photoKeys.map((key, i) =>
      db.prepare(`INSERT INTO item_photos (item_id, key, position) VALUES (?1, ?2, ?3)`).bind(itemId, key, i),
    ),
  ]);
}

/** Первое появление вещи в каталоге — рассказываем о ней в чатах кругов. */
async function announceIfNew(env: Env, itemId: number, owner: TgUser, announce: boolean): Promise<void> {
  const item = await env.DB.prepare(
    `UPDATE items SET announced = 1 WHERE id = ?1 AND announced = 0 AND status = 'available'
     RETURNING id, title, kind, direction`,
  )
    .bind(itemId)
    .first<{ id: number; title: string; kind: Kind; direction: Direction }>();
  if (!item || !announce) return;
  const chats = await env.DB.prepare(
    `SELECT c.chat_id, c.thread_id, c.lang FROM item_circles ic JOIN circles c ON c.id = ic.circle_id AND c.active = 1 WHERE ic.item_id = ?1`,
  )
    .bind(itemId)
    .all<{ chat_id: number; thread_id: number | null; lang: string | null }>();
  const photo = await env.DB.prepare(`SELECT key FROM item_photos WHERE item_id = ?1 ORDER BY position LIMIT 1`)
    .bind(itemId)
    .first<{ key: string }>();
  await notifyNewItem(env, item, displayName(owner), chats.results, photo?.key);
}

api.get("/items", async (c) => {
  const user = c.get("user");
  const q = c.req.query();
  const where: string[] = [];
  const args: unknown[] = [user.id];
  const arg = (v: unknown) => `?${args.push(v)}`;

  if (q.mine === "1") {
    where.push(`i.owner_id = ?1`);
  } else {
    const circleFilter = q.circle ? `AND ic.circle_id = ${arg(Number(q.circle))}` : "";
    where.push(
      `i.status IN ('available','busy') AND EXISTS (
         SELECT 1 FROM item_circles ic
         JOIN memberships m ON m.circle_id = ic.circle_id AND m.user_id = ?1
         JOIN circles c ON c.id = ic.circle_id AND c.active = 1
         WHERE ic.item_id = i.id ${circleFilter})`,
    );
  }
  if (KINDS.includes(q.kind as Kind)) where.push(`i.kind = ${arg(q.kind)}`);
  if (DIRECTIONS.includes(q.direction as Direction)) where.push(`i.direction = ${arg(q.direction)}`);
  const text = (q.q ?? "").trim().toLowerCase();
  if (text) where.push(`instr(i.search, ${arg(text)}) > 0`);

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.kind, i.direction, i.title, i.status, i.owner_id AS ownerId,
            u.first_name AS ownerName,
            (SELECT key FROM item_photos p WHERE p.item_id = i.id ORDER BY position LIMIT 1) AS photo
     FROM items i JOIN users u ON u.id = i.owner_id
     WHERE ${where.join(" AND ")}
     ORDER BY i.created_at DESC, i.id DESC LIMIT 200`,
  )
    .bind(...args)
    .all();
  return c.json({ items: results });
});

api.get("/items/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const db = c.env.DB;
  if (!(await canSee(db, id, user.id))) return c.json({ error: E(c).itemUnavailable }, 404);

  const item = (await db
    .prepare(
      `SELECT i.id, i.kind, i.direction, i.title, i.description, i.status, i.owner_id,
              u.first_name, u.last_name, u.username
       FROM items i JOIN users u ON u.id = i.owner_id WHERE i.id = ?1`,
    )
    .bind(id)
    .first<any>())!;
  const isOwner = item.owner_id === user.id;

  const [photos, circles, active] = await db.batch<any>([
    db.prepare(`SELECT key FROM item_photos WHERE item_id = ?1 ORDER BY position`).bind(id),
    db
      .prepare(
        `SELECT c.id, c.title FROM item_circles ic JOIN circles c ON c.id = ic.circle_id
         JOIN memberships m ON m.circle_id = c.id AND m.user_id = ?2 WHERE ic.item_id = ?1 ORDER BY c.title`,
      )
      .bind(id, user.id),
    db
      .prepare(
        `SELECT r.id, r.requester_id, r.status, r.message, r.due_date, u.first_name, u.last_name, u.username
         FROM requests r JOIN users u ON u.id = r.requester_id
         WHERE r.item_id = ?1 AND r.status IN ('pending','accepted','handed') ORDER BY r.created_at`,
      )
      .bind(id),
  ]);

  const toReq = (r: any) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    dueDate: r.due_date,
    name: displayName(r),
    username: r.username,
  });
  const lendable = isLendable(item);
  const holderRow = lendable ? active.results.find((r: any) => r.status === "accepted" || r.status === "handed") : null;
  const mine = active.results.find((r: any) => r.requester_id === user.id);

  return c.json({
    id: item.id,
    kind: item.kind,
    direction: item.direction,
    title: item.title,
    description: item.description,
    status: item.status,
    lendable,
    isOwner,
    owner: { id: item.owner_id, name: displayName(item), username: item.username },
    photos: photos.results.map((p: any) => p.key),
    circles: circles.results,
    holder: holderRow ? { name: displayName(holderRow), dueDate: holderRow.due_date, status: holderRow.status } : null,
    myRequest: mine ? toReq(mine) : null,
    requests: isOwner ? active.results.map(toReq) : [],
  });
});

api.post("/items", async (c) => {
  const user = c.get("user");
  const allowed = new Set((await myCircles(c.env.DB, user.id)).map((x) => x.id));
  const input = parseItem(await c.req.json().catch(() => null), allowed, E(c));
  if (typeof input === "string") return c.json({ error: input }, 400);

  // Одна транзакция: вещь, её круги, фото и запись в журнале появляются вместе или не появляются вовсе.
  const db = c.env.DB;
  const newId = `(SELECT MAX(id) FROM items WHERE owner_id = ?1)`;
  const results = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO items (owner_id, kind, direction, title, description, search, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id`,
      )
      .bind(user.id, input.kind, input.direction, input.title, input.description, searchText(input.title, input.description), input.status),
    ...input.circleIds.map((cid) =>
      db.prepare(`INSERT INTO item_circles (item_id, circle_id) VALUES (${newId}, ?2)`).bind(user.id, cid),
    ),
    ...input.photoKeys.map((key, i) =>
      db.prepare(`INSERT INTO item_photos (item_id, key, position) VALUES (${newId}, ?2, ?3)`).bind(user.id, key, i),
    ),
    db.prepare(`INSERT INTO events (item_id, actor_id, type) VALUES (${newId}, ?1, 'item_created')`).bind(user.id),
  ]);
  const id = results[0].results[0].id;
  await announceIfNew(c.env, id, user, input.announce);
  return c.json({ id }, 201);
});

api.put("/items/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const db = c.env.DB;
  const existing = await db.prepare(`SELECT owner_id, status FROM items WHERE id = ?1`).bind(id).first<{ owner_id: number; status: ItemStatus }>();
  if (!existing || existing.owner_id !== user.id) return c.json({ error: E(c).itemNotFound }, 404);

  const allowed = new Set((await myCircles(db, user.id)).map((x) => x.id));
  const input = parseItem(await c.req.json().catch(() => null), allowed, E(c));
  if (typeof input === "string") return c.json({ error: input }, 400);

  // Пока вещь у кого-то на руках, её статус меняется только через запрос.
  const status = existing.status === "busy" ? "busy" : input.status;
  const old = await db.prepare(`SELECT key FROM item_photos WHERE item_id = ?1`).bind(id).all<{ key: string }>();

  await db
    .prepare(
      `UPDATE items SET kind = ?2, direction = ?3, title = ?4, description = ?5, search = ?6, status = ?7,
         updated_at = datetime('now') WHERE id = ?1`,
    )
    .bind(id, input.kind, input.direction, input.title, input.description, searchText(input.title, input.description), status)
    .run();
  await saveRelations(db, id, input);

  const removed = old.results.map((r) => r.key).filter((k) => !input.photoKeys.includes(k));
  if (removed.length) await c.env.PHOTOS.delete(removed);
  await announceIfNew(c.env, id, user, input.announce);
  return c.json({ id });
});

api.delete("/items/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const db = c.env.DB;
  const existing = await db.prepare(`SELECT owner_id FROM items WHERE id = ?1`).bind(id).first<{ owner_id: number }>();
  if (!existing || existing.owner_id !== user.id) return c.json({ error: E(c).itemNotFound }, 404);
  const busy = await db.prepare(`SELECT 1 AS x FROM requests WHERE item_id = ?1 AND status IN ('accepted','handed')`).bind(id).first();
  if (busy) return c.json({ error: E(c).finishFirst }, 409);

  const photos = await db.prepare(`SELECT key FROM item_photos WHERE item_id = ?1`).bind(id).all<{ key: string }>();
  await db.batch([
    db.prepare(`DELETE FROM items WHERE id = ?1`).bind(id),
    db.prepare(`INSERT INTO events (item_id, actor_id, type) VALUES (?1, ?2, 'item_deleted')`).bind(id, user.id),
  ]);
  if (photos.results.length) await c.env.PHOTOS.delete(photos.results.map((p) => p.key));
  return c.json({ ok: true });
});

// ---------- Запросы ----------

api.post("/items/:id/requests", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const db = c.env.DB;
  if (!(await canSee(db, id, user.id))) return c.json({ error: E(c).itemUnavailable }, 404);

  const item = (await db
    .prepare(`SELECT id, owner_id, kind, direction, title, status FROM items WHERE id = ?1`)
    .bind(id)
    .first<{ id: number; owner_id: number; kind: Kind; direction: Direction; title: string; status: ItemStatus }>())!;
  if (item.owner_id === user.id) return c.json({ error: E(c).ownItem }, 400);
  if (item.status !== "available") return c.json({ error: E(c).unavailable }, 409);

  const dup = await db
    .prepare(`SELECT 1 AS x FROM requests WHERE item_id = ?1 AND requester_id = ?2 AND status IN ('pending','accepted','handed')`)
    .bind(id, user.id)
    .first();
  if (dup) return c.json({ error: E(c).duplicate }, 409);

  const body = (await c.req.json().catch(() => ({}))) as { message?: unknown; dueDate?: unknown };
  const message = String(body.message ?? "").trim().slice(0, 500);
  const dueDate = typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;

  const row = await db
    .prepare(`INSERT INTO requests (item_id, requester_id, status, message, due_date) VALUES (?1, ?2, 'pending', ?3, ?4) RETURNING id`)
    .bind(id, user.id, message, dueDate)
    .first<{ id: number }>();
  await db
    .prepare(`INSERT INTO events (item_id, request_id, actor_id, type) VALUES (?1, ?2, ?3, 'request_pending')`)
    .bind(id, row!.id, user.id)
    .run();
  await notifyNewRequest(c.env, { requestId: row!.id, item, requesterName: displayName(user), message, dueDate });
  return c.json({ id: row!.id }, 201);
});

api.get("/requests", async (c) => {
  const user = c.get("user");
  const select = (mineIs: "owner" | "requester") => `
    SELECT r.id, r.status, r.message, r.due_date AS dueDate, r.updated_at AS updatedAt,
           i.id AS itemId, i.title, i.kind, i.direction,
           u.first_name, u.last_name, u.username
    FROM requests r JOIN items i ON i.id = r.item_id
    JOIN users u ON u.id = ${mineIs === "owner" ? "r.requester_id" : "i.owner_id"}
    WHERE ${mineIs === "owner" ? "i.owner_id" : "r.requester_id"} = ?1
    ORDER BY CASE WHEN r.status IN ('pending','accepted','handed') THEN 0 ELSE 1 END, r.updated_at DESC, r.id DESC
    LIMIT 100`;
  const [incoming, outgoing] = await c.env.DB.batch<any>([
    c.env.DB.prepare(select("owner")).bind(user.id),
    c.env.DB.prepare(select("requester")).bind(user.id),
  ]);
  const shape = (r: any) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    dueDate: r.dueDate,
    itemId: r.itemId,
    title: r.title,
    lendable: isLendable(r),
    direction: r.direction,
    person: { name: displayName(r), username: r.username },
  });
  return c.json({ incoming: incoming.results.map(shape), outgoing: outgoing.results.map(shape) });
});

api.post("/requests/:id/:action", async (c) => {
  const action = c.req.param("action") as Action;
  if (!ACTIONS.includes(action)) return c.json({ error: E(c).unknownAction }, 400);
  const result = await applyAction(c.env, Number(c.req.param("id")), c.get("user").id, action);
  if (!result.ok) return c.json({ error: E(c)[result.error] }, result.code);
  return c.json({ status: result.status });
});
