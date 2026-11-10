import { getLang } from "./db";
import { isLendable, type ReqStatus } from "./flow";
import { asLang, formatDate, tr, type Lang } from "./i18n";
import { appButton, deepLink, esc, sendMessage, tg } from "./telegram";
import type { Direction, Env, Kind } from "./types";

interface ItemInfo {
  id: number;
  title: string;
  kind: Kind;
  direction: Direction;
}

export interface ChatTarget {
  chat_id: number;
  thread_id: number | null;
  lang: string | null;
}

/** Новая запись в каталоге — сообщение в чат каждого её круга, на языке этого круга. */
export async function notifyNewItem(env: Env, item: ItemInfo, ownerName: string, targets: ChatTarget[], photoKey?: string): Promise<void> {
  for (const target of targets) {
    const t = tr(asLang(target.lang) ?? "en");
    const text = `🆕 <b>${esc(item.title)}</b>\n${t.kind[item.kind]} · ${t.direction[item.direction]} · ${esc(ownerName)}`;
    const markup = { inline_keyboard: [[{ text: t.view, url: deepLink(env, `i${item.id}`) }]] };
    const thread = target.thread_id ? { message_thread_id: target.thread_id } : {};
    const sent =
      (photoKey &&
        (await tg(env, "sendPhoto", {
          chat_id: target.chat_id,
          ...thread,
          photo: `${env.APP_URL}/api/photos/${photoKey}`,
          caption: text,
          parse_mode: "HTML",
          reply_markup: markup,
        }))) ||
      (await sendMessage(env, target.chat_id, text, markup, target.thread_id));
    // Тему могли удалить — тогда пишем в общий чат, чтобы новинка не потерялась.
    if (!sent && target.thread_id) await sendMessage(env, target.chat_id, text, markup);
  }
}

/** Новый запрос — владельцу в личку, с кнопками «Принять» и «Отклонить». */
export async function notifyNewRequest(
  env: Env,
  p: { requestId: number; item: ItemInfo & { owner_id: number }; requesterName: string; message: string; dueDate: string | null },
): Promise<void> {
  const lang = await getLang(env.DB, p.item.owner_id);
  const t = tr(lang);
  const head = (p.item.direction === "want" ? t.newRequestWant : t.newRequestOffer)(esc(p.requesterName), esc(p.item.title));
  const lines = [head];
  if (p.message) lines.push(`\n«${esc(p.message)}»`);
  if (p.dueDate) lines.push(`\n${t.returnsBy(formatDate(p.dueDate, lang))}`);
  await sendMessage(env, p.item.owner_id, lines.join(""), {
    inline_keyboard: [
      [
        { text: t.accept, callback_data: `r:${p.requestId}:accept` },
        { text: t.decline, callback_data: `r:${p.requestId}:decline` },
      ],
      [appButton(env, t.open, `/item/${p.item.id}`)],
    ],
  });
}

export interface RequestInfo extends ItemInfo {
  owner_id: number;
  requester_id: number;
  due_date: string | null;
}

/** Смена статуса запроса — второй стороне в личку, на её языке. */
export async function notifyRequestChange(
  env: Env,
  r: RequestInfo,
  next: ReqStatus,
  actor: { id: number; name: string; username: string | null },
): Promise<void> {
  const recipient = actor.id === r.owner_id ? r.requester_id : r.owner_id;
  const lang: Lang = await getLang(env.DB, recipient);
  const t = tr(lang);
  const title = esc(r.title);
  const who = `<b>${esc(actor.name)}</b>`;
  let text: string;
  switch (next) {
    case "accepted":
      text = t.accepted(who, title);
      break;
    case "declined":
      text = t.declined(who, title);
      break;
    case "handed":
      text = t.handed(title, r.due_date ? formatDate(r.due_date, lang) : null);
      break;
    case "done":
      text = isLendable(r) ? t.doneLend(title) : t.doneOther(who, title);
      break;
    case "cancelled":
      text = t.cancelled(who, title);
      break;
    default:
      return;
  }
  const rows: unknown[][] = [[appButton(env, t.open, `/item/${r.id}`)]];
  if (next === "accepted" && actor.username) {
    rows.unshift([{ text: t.writeTo(actor.name), url: `https://t.me/${actor.username}` }]);
  }
  await sendMessage(env, recipient, text, { inline_keyboard: rows });
}

/** Ежедневные напоминания: завтра срок возврата и срок прошёл вчера. */
export async function runReminders(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT r.requester_id, r.due_date, i.id, i.title, i.owner_id, u.first_name AS requester_name,
            u.lang AS requester_lang, o.lang AS owner_lang,
            CASE WHEN r.due_date = date('now', '+1 day') THEN 'soon' ELSE 'overdue' END AS type
     FROM requests r JOIN items i ON i.id = r.item_id
     JOIN users u ON u.id = r.requester_id JOIN users o ON o.id = i.owner_id
     WHERE r.status = 'handed' AND r.due_date IN (date('now', '+1 day'), date('now', '-1 day'))`,
  ).all<{
    requester_id: number;
    due_date: string;
    id: number;
    title: string;
    owner_id: number;
    requester_name: string;
    requester_lang: string | null;
    owner_lang: string | null;
    type: string;
  }>();

  for (const r of results) {
    const title = esc(r.title);
    const rl = asLang(r.requester_lang) ?? "en";
    const ol = asLang(r.owner_lang) ?? "en";
    const markup = (lang: Lang) => ({ inline_keyboard: [[appButton(env, tr(lang).open, `/item/${r.id}`)]] });
    if (r.type === "soon") {
      await sendMessage(env, r.requester_id, tr(rl).dueSoon(title), markup(rl));
    } else {
      await sendMessage(env, r.requester_id, tr(rl).overdueRequester(title), markup(rl));
      await sendMessage(env, r.owner_id, tr(ol).overdueOwner(esc(r.requester_name), title, formatDate(r.due_date, ol)), markup(ol));
    }
  }
}
