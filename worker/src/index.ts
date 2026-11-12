import { Hono } from "hono";
import { api } from "./api";
import { asLang, tr } from "./i18n";
import { handleUpdate, type Update } from "./bot";
import { runReminders } from "./notify";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", api);

app.post("/bot/webhook", async (c) => {
  if (!c.env.WEBHOOK_SECRET || c.req.header("X-Telegram-Bot-Api-Secret-Token") !== c.env.WEBHOOK_SECRET) {
    return c.text("forbidden", 403);
  }
  try {
    await handleUpdate(c.env, (await c.req.json()) as Update);
  } catch (e) {
    // Отвечаем 200 в любом случае, иначе Telegram будет повторять тот же апдейт.
    console.error("update failed", e);
  }
  return c.json({ ok: true });
});

app.onError((e, c) => {
  const user = (c as any).get("user") as { id: number } | undefined;
  console.error(JSON.stringify({ msg: "request failed", method: c.req.method, path: c.req.path, user: user?.id ?? null, error: String(e), stack: (e as Error)?.stack }));
  return c.json({ error: tr(asLang((c as any).get("lang")) ?? "en").err.generic }, 500);
});

export { app };

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runReminders(env));
  },
};
