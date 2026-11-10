import type { Env } from "./types";

/**
 * Вызов Bot API. Никогда не бросает исключение: при ошибке пишет в лог и
 * возвращает null, чтобы сбой уведомления не ломал основное действие.
 * В локальной разработке без настоящего токена вызовы только логируются.
 */
export async function tg<T = unknown>(env: Env, method: string, params: Record<string, unknown> = {}): Promise<T | null> {
  if (isDry(env)) {
    console.log(`[telegram dry-run] ${method}`, JSON.stringify(params));
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      console.error(`telegram ${method} failed: ${json.description}`);
      return null;
    }
    return json.result ?? null;
  } catch (e) {
    console.error(`telegram ${method} error`, e);
    return null;
  }
}

export const isDry = (env: Env) => env.DEV_AUTH === "1" && (!env.BOT_TOKEN || env.BOT_TOKEN === "dev");

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const sendMessage = (env: Env, chatId: number, text: string, replyMarkup?: unknown, threadId?: number | null) =>
  tg(env, "sendMessage", {
    chat_id: chatId,
    ...(threadId ? { message_thread_id: threadId } : {}),
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

/** Кнопка, открывающая Mini App на нужном экране. Работает только в личных чатах. */
export const appButton = (env: Env, text: string, path = "/") => ({
  text,
  web_app: { url: path === "/" ? env.APP_URL : `${env.APP_URL}/?go=${encodeURIComponent(path)}` },
});

/** Ссылка, открывающая Mini App из группового чата (там web_app-кнопки запрещены). */
export const deepLink = (env: Env, startParam: string) => `https://t.me/${env.BOT_USERNAME}?startapp=${startParam}`;
