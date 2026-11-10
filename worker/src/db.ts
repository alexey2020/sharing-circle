import { asLang, pickLang, type Lang } from "./i18n";
import { tg } from "./telegram";
import type { Env, TgUser } from "./types";

export const displayName = (u: { first_name: string; last_name?: string | null }) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ");

/**
 * Сохраняет человека и возвращает его язык. Язык берётся из Telegram при первом появлении
 * и дальше меняется только самим человеком.
 */
export async function upsertUser(db: D1Database, u: TgUser, canWrite = false): Promise<Lang> {
  const write = canWrite || u.allows_write_to_pm ? 1 : 0;
  // Вызывается на каждый запрос, поэтому пишем в базу, только если что-то изменилось.
  const cur = await db
    .prepare(`SELECT first_name, last_name, username, can_write, lang FROM users WHERE id = ?1`)
    .bind(u.id)
    .first<{ first_name: string; last_name: string | null; username: string | null; can_write: number; lang: string | null }>();
  const lang = asLang(cur?.lang) ?? pickLang(u.language_code);
  if (
    cur &&
    cur.lang &&
    cur.first_name === u.first_name &&
    cur.last_name === (u.last_name ?? null) &&
    cur.username === (u.username ?? null) &&
    cur.can_write >= write
  ) {
    return lang;
  }
  await db
    .prepare(
      `INSERT INTO users (id, first_name, last_name, username, can_write, lang) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name,
         username = excluded.username, can_write = MAX(can_write, excluded.can_write),
         lang = COALESCE(users.lang, excluded.lang)`,
    )
    .bind(u.id, u.first_name, u.last_name ?? null, u.username ?? null, write, lang)
    .run();
  return lang;
}

export async function getLang(db: D1Database, userId: number): Promise<Lang> {
  const row = await db.prepare(`SELECT lang FROM users WHERE id = ?1`).bind(userId).first<{ lang: string | null }>();
  return asLang(row?.lang) ?? "en";
}

export async function upsertCircle(
  db: D1Database,
  chatId: number,
  title: string,
  createdBy: number | null = null,
  lang: Lang | null = null,
): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO circles (chat_id, title, created_by, lang) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(chat_id) DO UPDATE SET title = excluded.title, active = 1,
         created_by = COALESCE(circles.created_by, excluded.created_by),
         lang = COALESCE(circles.lang, excluded.lang) RETURNING id`,
    )
    .bind(chatId, title, createdBy, lang)
    .first<{ id: number }>();
  return row!.id;
}

export interface Rights {
  isAdmin: boolean;
  canCreate: boolean;
}

/** Администратор — владелец сервиса; создавать круги могут он и приглашённые им люди. */
export async function getRights(db: D1Database, userId: number): Promise<Rights> {
  const row = await db
    .prepare(`SELECT is_admin, can_create FROM users WHERE id = ?1`)
    .bind(userId)
    .first<{ is_admin: number; can_create: number }>();
  return { isAdmin: !!row?.is_admin, canCreate: !!row?.is_admin || !!row?.can_create };
}

export interface Circle {
  id: number;
  title: string;
}

export async function myCircles(db: D1Database, userId: number): Promise<Circle[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.title FROM circles c JOIN memberships m ON m.circle_id = c.id
       WHERE m.user_id = ?1 AND c.active = 1 ORDER BY c.title`,
    )
    .bind(userId)
    .all<Circle>();
  return results;
}

/** Видит ли пользователь вещь: он владелец или состоит в одном из её кругов. */
export async function canSee(db: D1Database, itemId: number, userId: number): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM items i WHERE i.id = ?1 AND (
         i.owner_id = ?2 OR (i.status IN ('available','busy') AND EXISTS (
           SELECT 1 FROM item_circles ic
           JOIN memberships m ON m.circle_id = ic.circle_id AND m.user_id = ?2
           JOIN circles c ON c.id = ic.circle_id AND c.active = 1
           WHERE ic.item_id = i.id)))`,
    )
    .bind(itemId, userId)
    .first();
  return !!row;
}

interface ChatMember {
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
  is_member?: boolean;
}

/** true — состоит в чате, false — точно не состоит, null — Telegram не ответил. */
async function isChatMember(env: Env, chatId: number, userId: number): Promise<boolean | null> {
  const m = await tg<ChatMember>(env, "getChatMember", { chat_id: chatId, user_id: userId });
  if (!m) return null;
  if (m.status === "restricted") return !!m.is_member;
  return m.status === "creator" || m.status === "administrator" || m.status === "member";
}

/** Добавляет пользователя в круг, если он участник соответствующего чата. */
export async function joinCircle(env: Env, userId: number, circleId: number): Promise<boolean> {
  const circle = await env.DB.prepare(`SELECT chat_id FROM circles WHERE id = ?1 AND active = 1`)
    .bind(circleId)
    .first<{ chat_id: number }>();
  if (!circle) return false;
  if ((await isChatMember(env, circle.chat_id, userId)) !== true) return false;
  await env.DB.prepare(
    `INSERT INTO memberships (user_id, circle_id) VALUES (?1, ?2)
     ON CONFLICT(user_id, circle_id) DO UPDATE SET checked_at = datetime('now')`,
  )
    .bind(userId, circleId)
    .run();
  return true;
}

/** Переход по ссылке на вещь из чата: вступаем в те её круги, в чатах которых человек состоит. */
export async function joinCirclesOfItem(env: Env, userId: number, itemId: number): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT ic.circle_id FROM item_circles ic
     WHERE ic.item_id = ?1 AND NOT EXISTS (
       SELECT 1 FROM memberships m WHERE m.circle_id = ic.circle_id AND m.user_id = ?2)`,
  )
    .bind(itemId, userId)
    .all<{ circle_id: number }>();
  for (const r of results) await joinCircle(env, userId, r.circle_id);
}

/** Раз в сутки перепроверяем членство: вышедшие из чата теряют доступ к кругу. */
export async function refreshMemberships(env: Env, userId: number): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT m.circle_id, c.chat_id FROM memberships m JOIN circles c ON c.id = m.circle_id
     WHERE m.user_id = ?1 AND c.active = 1 AND m.checked_at < datetime('now', '-1 day')`,
  )
    .bind(userId)
    .all<{ circle_id: number; chat_id: number }>();
  for (const r of results) {
    const member = await isChatMember(env, r.chat_id, userId);
    if (member === false) {
      await env.DB.prepare(`DELETE FROM memberships WHERE user_id = ?1 AND circle_id = ?2`).bind(userId, r.circle_id).run();
    } else if (member === true) {
      await env.DB.prepare(`UPDATE memberships SET checked_at = datetime('now') WHERE user_id = ?1 AND circle_id = ?2`)
        .bind(userId, r.circle_id)
        .run();
    }
  }
}
