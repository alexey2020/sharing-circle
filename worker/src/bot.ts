import { displayName, getLang, getRights, upsertCircle, upsertUser } from "./db";
import { asLang, LANG_NAMES, LANGS, tr, type Lang } from "./i18n";
import { applyAction } from "./requests";
import { appButton, deepLink, esc, sendMessage, tg } from "./telegram";
import type { Env, TgUser } from "./types";

interface Chat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
}
interface Message {
  message_id: number;
  chat: Chat;
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: { file_id: string; file_size?: number }[];
  message_thread_id?: number;
  is_topic_message?: boolean;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  new_chat_title?: string;
}
export interface Update {
  message?: Message;
  my_chat_member?: { chat: Chat; from: TgUser; new_chat_member: { status: string } };
  callback_query?: { id: string; from: TgUser; data?: string; message?: Message };
}

interface CircleRow {
  id: number;
  created_by: number | null;
  lang: string | null;
}

export async function handleUpdate(env: Env, update: Update): Promise<void> {
  if (update.my_chat_member) return onMembership(env, update.my_chat_member);
  if (update.callback_query) return onCallback(env, update.callback_query);
  if (update.message) return onMessage(env, update.message);
}

const isGroup = (chat: Chat) => chat.type === "group" || chat.type === "supergroup";
const topicOf = (msg: Message) => (msg.is_topic_message && msg.message_thread_id ? msg.message_thread_id : null);
const langButtons = () => ({ inline_keyboard: [LANGS.map((l) => ({ text: LANG_NAMES[l], callback_data: `lang:${l}` }))] });

const activeCircle = (env: Env, chatId: number) =>
  env.DB.prepare(`SELECT id, created_by, lang FROM circles WHERE chat_id = ?1 AND active = 1`).bind(chatId).first<CircleRow>();

async function sendIntro(env: Env, chatId: number, circleId: number, lang: Lang, threadId?: number | null): Promise<void> {
  const t = tr(lang);
  await sendMessage(env, chatId, t.intro, { inline_keyboard: [[{ text: t.openCatalog, url: deepLink(env, `c${circleId}`) }]] }, threadId);
}

/** Создаёт круг, если у человека есть на это право; иначе объясняет и выходит из чата. */
async function createCircle(env: Env, chat: Chat, by: TgUser): Promise<void> {
  const lang = await upsertUser(env.DB, by);
  if (!(await getRights(env.DB, by.id)).canCreate) {
    await sendMessage(env, chat.id, tr(lang).inviteOnly);
    await tg(env, "leaveChat", { chat_id: chat.id });
    return;
  }
  const id = await upsertCircle(env.DB, chat.id, chat.title ?? tr(lang).circleDefault, by.id, lang);
  // Добавивший бота точно в чате — сразу записываем его в круг, не дожидаясь кнопки «Открыть каталог».
  await env.DB.prepare(
    `INSERT INTO memberships (user_id, circle_id) VALUES (?1, ?2)
     ON CONFLICT(user_id, circle_id) DO UPDATE SET checked_at = datetime('now')`,
  )
    .bind(by.id, id)
    .run();
  const circle = await activeCircle(env, chat.id);
  await sendIntro(env, chat.id, id, asLang(circle?.lang) ?? lang);
}

/** Бота добавили в чат или убрали из него: чат становится кругом или перестаёт им быть. */
async function onMembership(env: Env, m: NonNullable<Update["my_chat_member"]>): Promise<void> {
  if (!isGroup(m.chat)) return;
  const status = m.new_chat_member.status;
  if (status === "member" || status === "administrator") {
    if (await activeCircle(env, m.chat.id)) return; // например, бота сделали администратором
    await createCircle(env, m.chat, m.from);
  } else if (status === "left" || status === "kicked") {
    await env.DB.prepare(`UPDATE circles SET active = 0 WHERE chat_id = ?1`).bind(m.chat.id).run();
  }
}

/**
 * Переносит круг на новый номер чата. Если бот уже успел завести круг для нового номера
 * (например, увидев себя в «новом» чате), объединяет оба круга в тот, что относится к живому чату.
 */
export async function migrateChat(env: Env, oldChatId: number, newChatId: number): Promise<void> {
  const db = env.DB;
  const old = await db.prepare(`SELECT id FROM circles WHERE chat_id = ?1`).bind(oldChatId).first<{ id: number }>();
  if (!old) return;
  const fresh = await db.prepare(`SELECT id FROM circles WHERE chat_id = ?1`).bind(newChatId).first<{ id: number }>();
  if (!fresh) {
    await db.prepare(`UPDATE circles SET chat_id = ?2, active = 1 WHERE id = ?1`).bind(old.id, newChatId).run();
    return;
  }
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO item_circles (item_id, circle_id) SELECT item_id, ?2 FROM item_circles WHERE circle_id = ?1`).bind(old.id, fresh.id),
    db
      .prepare(`INSERT OR IGNORE INTO memberships (user_id, circle_id, checked_at) SELECT user_id, ?2, checked_at FROM memberships WHERE circle_id = ?1`)
      .bind(old.id, fresh.id),
    db
      .prepare(
        `UPDATE circles SET active = 1,
           thread_id = COALESCE(thread_id, (SELECT thread_id FROM circles WHERE id = ?1)),
           created_by = COALESCE((SELECT created_by FROM circles WHERE id = ?1), created_by),
           lang = COALESCE((SELECT lang FROM circles WHERE id = ?1), lang)
         WHERE id = ?2`,
      )
      .bind(old.id, fresh.id),
    db.prepare(`DELETE FROM item_circles WHERE circle_id = ?1`).bind(old.id),
    db.prepare(`DELETE FROM memberships WHERE circle_id = ?1`).bind(old.id),
    db.prepare(`DELETE FROM circles WHERE id = ?1`).bind(old.id),
  ]);
}

/** Настройки круга меняют его создатель, администратор сервиса и администраторы чата. */
async function canManage(env: Env, chatId: number, circle: CircleRow, userId: number): Promise<boolean> {
  if (circle.created_by === userId || (await getRights(env.DB, userId)).isAdmin) return true;
  const member = await tg<{ status: string }>(env, "getChatMember", { chat_id: chatId, user_id: userId });
  return member?.status === "creator" || member?.status === "administrator";
}

async function onGroupMessage(env: Env, msg: Message): Promise<void> {
  // Включение тем (и некоторые другие настройки) превращает группу в супергруппу с новым номером чата.
  // Telegram сообщает об этом в обоих чатах, порядок не гарантирован, поэтому обрабатываем оба сообщения.
  if (msg.migrate_to_chat_id) return migrateChat(env, msg.chat.id, msg.migrate_to_chat_id);
  if (msg.migrate_from_chat_id) return migrateChat(env, msg.migrate_from_chat_id, msg.chat.id);
  if (msg.new_chat_title) {
    await env.DB.prepare(`UPDATE circles SET title = ?2 WHERE chat_id = ?1`).bind(msg.chat.id, msg.new_chat_title).run();
    return;
  }
  const command = /^\/(\w+)(?:@\w+)?(?:\s|$)/.exec(msg.text ?? "")?.[1];
  if (!command || !msg.from) return;

  const circle = await activeCircle(env, msg.chat.id);
  const thread = topicOf(msg);

  if (command === "catalog" || command === "start") {
    if (circle) await sendIntro(env, msg.chat.id, circle.id, asLang(circle.lang) ?? "en", thread);
    else await createCircle(env, msg.chat, msg.from);
    return;
  }
  if (!circle) return;
  const t = tr(asLang(circle.lang) ?? "en");

  if (command === "here") {
    // /here в теме чата: новинки будут приходить в эту тему. /here вне тем — снова в общий чат.
    if (!(await canManage(env, msg.chat.id, circle, msg.from.id))) {
      await sendMessage(env, msg.chat.id, t.topicDenied, undefined, thread);
      return;
    }
    await env.DB.prepare(`UPDATE circles SET thread_id = ?2 WHERE id = ?1`).bind(circle.id, thread).run();
    await sendMessage(env, msg.chat.id, thread ? t.topicSet : t.topicUnset, undefined, thread);
  } else if (command === "lang") {
    await sendMessage(env, msg.chat.id, t.chooseCircleLang, langButtons(), thread);
  }
}

async function onMessage(env: Env, msg: Message): Promise<void> {
  if (isGroup(msg.chat)) return onGroupMessage(env, msg);
  if (msg.chat.type !== "private" || !msg.from) return;

  const from = msg.from;
  const lang = await upsertUser(env.DB, from, true);
  const t = tr(lang);

  if (msg.photo?.length) return quickAdd(env, msg, lang);

  const command = /^\/(\w+)(?:@\w+)?(?:\s+(\S+))?/.exec(msg.text ?? "");
  const name = command?.[1];
  const payload = name === "start" ? (command?.[2] ?? "") : "";
  if (payload.startsWith("admin_")) return claimAdmin(env, from, payload.slice(6), lang);
  if (payload.startsWith("inv_")) return acceptInvite(env, from, payload.slice(4), lang);

  if (name === "lang") {
    await sendMessage(env, from.id, t.chooseLang, langButtons());
    return;
  }

  const rights = await getRights(env.DB, from.id);
  if (rights.isAdmin && name === "invite") return createInvite(env, from, lang);
  if (rights.isAdmin && name === "circles") return listCircles(env, from, lang);
  if (rights.isAdmin && name === "setup") {
    await setCommands(env);
    await sendMessage(env, from.id, t.commandsUpdated);
    return;
  }

  const lines = [t.helpHead, rights.canCreate ? t.helpCreate : t.helpInvited, t.helpPhoto, t.helpRest, t.helpLang];
  if (rights.isAdmin) lines.push(t.helpAdmin);
  lines.push(t.helpRules(`${env.APP_URL}/#/terms`));
  const rows: unknown[][] = [[appButton(env, t.openCatalog)]];
  if (rights.canCreate) rows.push([addToChatButton(env, lang)]);
  await sendMessage(env, from.id, lines.join("\n"), { inline_keyboard: rows });
}

const addToChatButton = (env: Env, lang: Lang) => ({ text: tr(lang).addToChat, url: `https://t.me/${env.BOT_USERNAME}?startgroup=true` });

/** Меню команд бота: разное для личных и групповых чатов, на обоих языках. */
export async function setCommands(env: Env): Promise<void> {
  for (const lang of LANGS) {
    const c = tr(lang).cmd;
    const language = lang === "en" ? {} : { language_code: lang }; // английский — по умолчанию для всех остальных языков
    await tg(env, "setMyCommands", {
      scope: { type: "all_private_chats" },
      ...language,
      commands: [
        { command: "start", description: c.start },
        { command: "lang", description: c.lang },
      ],
    });
    await tg(env, "setMyCommands", {
      scope: { type: "all_group_chats" },
      ...language,
      commands: [
        { command: "catalog", description: c.catalog },
        { command: "here", description: c.here },
        { command: "lang", description: c.lang },
      ],
    });
  }
}

/** Владелец сервиса открывает секретную ссылку из scripts/setup.sh и становится администратором. */
async function claimAdmin(env: Env, from: TgUser, key: string, lang: Lang): Promise<void> {
  const t = tr(lang);
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    await sendMessage(env, from.id, t.badLink);
    return;
  }
  await env.DB.prepare(`UPDATE users SET is_admin = 1, can_create = 1 WHERE id = ?1`).bind(from.id).run();
  await setCommands(env);
  await sendMessage(env, from.id, t.adminWelcome, { inline_keyboard: [[addToChatButton(env, lang)]] });
}

async function createInvite(env: Env, from: TgUser, lang: Lang): Promise<void> {
  const t = tr(lang);
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await env.DB.prepare(`INSERT INTO invites (code, created_by) VALUES (?1, ?2)`).bind(code, from.id).run();
  const link = `https://t.me/${env.BOT_USERNAME}?start=inv_${code}`;
  await sendMessage(env, from.id, t.inviteText(link), {
    inline_keyboard: [[{ text: t.forward, url: `https://t.me/share/url?url=${encodeURIComponent(link)}` }]],
  });
}

async function acceptInvite(env: Env, from: TgUser, code: string, lang: Lang): Promise<void> {
  const t = tr(lang);
  const used = await env.DB.prepare(
    `UPDATE invites SET used_by = ?1, used_at = datetime('now') WHERE code = ?2 AND used_by IS NULL RETURNING code`,
  )
    .bind(from.id, code)
    .first();
  if (!used) {
    const already = (await getRights(env.DB, from.id)).canCreate;
    await sendMessage(env, from.id, already ? t.alreadyCan : t.inviteUsed, already ? { inline_keyboard: [[addToChatButton(env, lang)]] } : undefined);
    return;
  }
  await env.DB.prepare(`UPDATE users SET can_create = 1 WHERE id = ?1`).bind(from.id).run();
  await sendMessage(env, from.id, t.inviteAccepted, { inline_keyboard: [[addToChatButton(env, lang)]] });
}

async function listCircles(env: Env, from: TgUser, lang: Lang): Promise<void> {
  const t = tr(lang);
  const { results } = await env.DB.prepare(
    `SELECT c.title, c.active, u.first_name, u.last_name,
            (SELECT COUNT(*) FROM memberships m WHERE m.circle_id = c.id) AS members,
            (SELECT COUNT(*) FROM item_circles ic WHERE ic.circle_id = c.id) AS items
     FROM circles c LEFT JOIN users u ON u.id = c.created_by ORDER BY c.id`,
  ).all<{ title: string; active: number; first_name: string | null; last_name: string | null; members: number; items: number }>();
  const text = results.length
    ? results
        .map(
          (c, i) =>
            `${i + 1}. <b>${esc(c.title)}</b>${c.active ? "" : t.circleDisabled}\n` +
            t.circleStats(c.members, c.items) +
            (c.first_name ? t.circleCreatedBy(esc(displayName({ first_name: c.first_name, last_name: c.last_name }))) : ""),
        )
        .join("\n")
    : t.circlesEmpty;
  await sendMessage(env, from.id, text);
}

/** Быстрое добавление: фото с подписью превращается в черновик, который остаётся проверить. */
async function quickAdd(env: Env, msg: Message, lang: Lang): Promise<void> {
  const t = tr(lang);
  const from = msg.from!;
  const largest = msg.photo![msg.photo!.length - 1];
  const file = await tg<{ file_path?: string }>(env, "getFile", { file_id: largest.file_id });
  const res = file?.file_path ? await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`) : null;
  if (!res?.ok) {
    await sendMessage(env, msg.chat.id, t.photoFail);
    return;
  }
  const key = `${crypto.randomUUID()}.jpg`;
  await env.PHOTOS.put(key, await res.arrayBuffer(), { httpMetadata: { contentType: "image/jpeg" } });

  const [firstLine, ...rest] = (msg.caption ?? "").trim().split("\n");
  const title = firstLine.trim().slice(0, 100) || t.untitled;
  const description = rest.join("\n").trim().slice(0, 2000);

  const row = await env.DB.prepare(
    `INSERT INTO items (owner_id, kind, direction, title, description, search, status)
     VALUES (?1, 'thing', 'offer', ?2, ?3, ?4, 'draft') RETURNING id`,
  )
    .bind(from.id, title, description, `${title} ${description}`.toLowerCase())
    .first<{ id: number }>();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO item_photos (item_id, key, position) VALUES (?1, ?2, 0)`).bind(row!.id, key),
    env.DB.prepare(`INSERT INTO events (item_id, actor_id, type) VALUES (?1, ?2, 'item_created')`).bind(row!.id, from.id),
  ]);

  await sendMessage(env, msg.chat.id, t.draftReady(esc(title)), {
    inline_keyboard: [[appButton(env, t.reviewPublish, `/edit/${row!.id}`)]],
  });
}

async function onCallback(env: Env, cq: NonNullable<Update["callback_query"]>): Promise<void> {
  const answer = (text?: string, alert = false) =>
    tg(env, "answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text, show_alert: alert } : {}) });

  const langMatch = /^lang:(en|ru)$/.exec(cq.data ?? "");
  if (langMatch && cq.message) return onLangChoice(env, cq, langMatch[1] as Lang, answer);

  // Кнопки «Принять» / «Отклонить» под уведомлением о запросе.
  const m = /^r:(\d+):(accept|decline)$/.exec(cq.data ?? "");
  if (!m) {
    await answer();
    return;
  }
  const t = tr(await upsertUser(env.DB, cq.from, true));
  const result = await applyAction(env, Number(m[1]), cq.from.id, m[2] as "accept" | "decline");
  await answer(result.ok ? (result.status === "accepted" ? t.cbAccepted : t.cbDeclined) : t.err[result.error], !result.ok);
  if (cq.message) {
    // Убираем кнопки решения, оставляем только «Открыть».
    const rows = ((cq.message as any).reply_markup?.inline_keyboard ?? []).slice(1);
    await tg(env, "editMessageReplyMarkup", {
      chat_id: cq.message.chat.id,
      message_id: cq.message.message_id,
      reply_markup: { inline_keyboard: rows },
    });
  }
}

/** Выбор языка кнопкой: в личке — язык человека, в группе — язык сообщений бота в этом чате. */
async function onLangChoice(
  env: Env,
  cq: NonNullable<Update["callback_query"]>,
  lang: Lang,
  answer: (text?: string, alert?: boolean) => Promise<unknown>,
): Promise<void> {
  const chat = cq.message!.chat;
  const edit = (text: string) => tg(env, "editMessageText", { chat_id: chat.id, message_id: cq.message!.message_id, text });

  if (chat.type === "private") {
    await upsertUser(env.DB, cq.from, true);
    await env.DB.prepare(`UPDATE users SET lang = ?2 WHERE id = ?1`).bind(cq.from.id, lang).run();
    await answer();
    await edit(tr(lang).langSet);
    return;
  }
  const circle = await activeCircle(env, chat.id);
  if (!circle) {
    await answer();
    return;
  }
  if (!(await canManage(env, chat.id, circle, cq.from.id))) {
    await answer(tr(await getLang(env.DB, cq.from.id)).langDenied, true);
    return;
  }
  await env.DB.prepare(`UPDATE circles SET lang = ?2 WHERE id = ?1`).bind(circle.id, lang).run();
  await answer();
  await edit(tr(lang).circleLangSet);
}
