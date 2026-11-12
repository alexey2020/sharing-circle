import { readdirSync, readFileSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPlatformProxy } from "wrangler";
import { signInitData } from "../worker/src/auth";
import { handleUpdate } from "../worker/src/bot";
import { parseRdap, watchDomains } from "../worker/src/watch";
import { app } from "../worker/src/index";
import type { Env } from "../worker/src/types";

const TOKEN = "123456:TEST-TOKEN";
const STATE = ".test-state";

// Кто в каком чате состоит — так отвечает поддельный Telegram на getChatMember.
const chatMembers: Record<number, Set<number>> = { [-100]: new Set([11, 12, 15, 16]), [-200]: new Set([11, 13]) };
const NAMES: Record<number, string> = { 11: "Аня", 12: "Борис", 13: "Вера", 14: "Чужой", 15: "Глеб", 16: "Dana" };
const sent: { method: string; params: any }[] = [];

let env: Env;
let dispose: () => Promise<void>;

async function call(userId: number, method: string, path: string, body?: unknown, startParam?: string) {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: NAMES[userId], username: `u${userId}`, ...(userId === 16 ? {} : { language_code: "ru" }) }),
  };
  if (startParam) fields.start_param = startParam;
  const res = await app.request(
    `/api${path}`,
    {
      method,
      headers: { Authorization: `tma ${await signInitData(fields, TOKEN)}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
  return { status: res.status, json: (await res.json()) as any };
}

const lastSent = (method: string, chatId: number) =>
  [...sent].reverse().find((s) => s.method === method && s.params.chat_id === chatId);

const dm = (userId: number, text: string) =>
  handleUpdate(env, { message: { message_id: 1, chat: { id: userId, type: "private" }, from: { id: userId, first_name: NAMES[userId], language_code: "ru" }, text } });
const addBot = (chatId: number, title: string, by: number) =>
  handleUpdate(env, {
    my_chat_member: { chat: { id: chatId, type: "supergroup", title }, from: { id: by, first_name: NAMES[by], language_code: "ru" }, new_chat_member: { status: "member" } },
  });

beforeAll(async () => {
  rmSync(STATE, { recursive: true, force: true });
  const proxy = await getPlatformProxy<Env>({ persist: { path: STATE } });
  dispose = proxy.dispose;
  env = { ...proxy.env, BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "s", BOT_USERNAME: "test_bot", APP_URL: "https://app.test", ADMIN_KEY: "topsecret", DEV_AUTH: undefined };

  const sql = readdirSync("worker/migrations").sort().map((f) => readFileSync(`worker/migrations/${f}`, "utf8")).join("\n").replace(/--.*$/gm, "");
  for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) await env.DB.prepare(stmt).run();

  vi.stubGlobal("fetch", async (url: string, init: any) => {
    const method = String(url).split("/").pop()!;
    const params = JSON.parse(init.body);
    sent.push({ method, params });
    let result: unknown = true;
    if (method === "getChatMember") {
      result = { status: chatMembers[params.chat_id]?.has(params.user_id) ? "member" : "left" };
    }
    return new Response(JSON.stringify({ ok: true, result }));
  });

  // Аня — владелец сервиса: становится администратором по секретной ссылке и создаёт оба круга.
  await dm(11, "/start admin_topsecret");
  for (const [chatId, title] of [[-100, "Друзья"], [-200, "Книжный клуб"]] as const) await addBot(chatId, title, 11);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await dispose?.();
  rmSync(STATE, { recursive: true, force: true });
});

describe("вход", () => {
  it("без подписи Telegram не пускает, dev-заголовок в бою не работает", async () => {
    const res = await app.request("/api/me", { headers: { "X-Dev-User": "1" } }, env);
    expect(res.status).toBe(401);
  });
});

describe("правила", () => {
  it("без согласия с правилами нельзя публиковать и просить; согласие запоминается", async () => {
    const me = await call(11, "GET", "/me");
    expect(me.json.termsAccepted).toBe(false);
    const res = await call(11, "POST", "/items", { kind: "thing", direction: "offer", title: "Рано", description: "", circleIds: [], photoKeys: [] });
    expect(res.status).toBe(403);
    expect(res.json.error).toBe("Сначала согласитесь с правилами");
    expect((await call(11, "POST", "/items/1/requests", {})).status).toBe(403);

    expect((await call(11, "POST", "/terms/accept")).status).toBe(200);
    expect((await call(11, "GET", "/me")).json.termsAccepted).toBe(true);
    const row = await env.DB.prepare(`SELECT terms_version, terms_accepted_at FROM users WHERE id = 11`).first<any>();
    expect(row.terms_version).toBe(1);
    expect(row.terms_accepted_at).toBeTruthy();
    for (const id of [12, 13, 14, 15, 16]) await call(id, "POST", "/terms/accept");
  });
});

describe("круги", () => {
  it("добавление бота в чат создаёт круг и приглашение в чате", async () => {
    const intro = lastSent("sendMessage", -100)!;
    expect(intro.params.reply_markup.inline_keyboard[0][0].url).toBe("https://t.me/test_bot?startapp=c1");
  });

  it("участник чата вступает в круг по ссылке, посторонний — нет", async () => {
    expect((await call(11, "GET", "/me", undefined, "c1")).json.circles).toEqual([{ id: 1, title: "Друзья" }]);
    expect((await call(11, "GET", "/me", undefined, "c2")).json.circles).toHaveLength(2);
    expect((await call(12, "GET", "/me", undefined, "c1")).json.circles).toHaveLength(1);
    expect((await call(13, "GET", "/me", undefined, "c2")).json.circles).toEqual([{ id: 2, title: "Книжный клуб" }]);
    expect((await call(15, "GET", "/me", undefined, "c1")).json.circles).toHaveLength(1);
    expect((await call(14, "GET", "/me", undefined, "c1")).json.circles).toEqual([]);
    expect((await call(12, "GET", "/me", undefined, "c2")).json.circles).toHaveLength(1);
  });
});

describe("приглашения", () => {
  const stubTelegram = () =>
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      sent.push({ method: String(url).split("/").pop()!, params: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: true }));
    });
  const circleFor = (chatId: number) => env.DB.prepare(`SELECT id, active, created_by FROM circles WHERE chat_id = ?1`).bind(chatId).first<any>();

  it("без приглашения круг не создаётся: бот объясняет и выходит из чата", async () => {
    stubTelegram();
    await dm(12, "/start");
    await addBot(-300, "Чат Бориса", 12);
    expect(await circleFor(-300)).toBeNull();
    expect(lastSent("sendMessage", -300)!.params.text).toContain("по приглашению");
    expect(lastSent("leaveChat", -300)).toBeTruthy();
  });

  it("чужой ключ не делает администратором, а /invite доступна только администратору", async () => {
    await dm(12, "/start admin_wrong");
    await dm(12, "/invite");
    const invites = await env.DB.prepare(`SELECT COUNT(*) AS n FROM invites`).first<{ n: number }>();
    expect(invites!.n).toBe(0);
    expect((await call(12, "GET", "/me")).json.canCreate).toBe(false);
  });

  it("приглашение одноразовое и даёт право создавать круги", async () => {
    await dm(11, "/invite");
    const link = /https:\/\/t\.me\/test_bot\?start=(inv_\w+)/.exec(lastSent("sendMessage", 11)!.params.text)!;
    await dm(12, `/start ${link[1]}`);
    expect((await call(12, "GET", "/me")).json.canCreate).toBe(true);

    await dm(13, `/start ${link[1]}`);
    expect(lastSent("sendMessage", 13)!.params.text).toContain("уже использовано");
    expect((await call(13, "GET", "/me")).json.canCreate).toBe(false);

    await addBot(-300, "Чат Бориса", 12);
    expect(await circleFor(-300)).toMatchObject({ active: 1, created_by: 12 });
    expect(lastSent("sendMessage", -300)!.params.reply_markup.inline_keyboard[0][0].url).toContain("startapp=c");
  });

  it("администратор видит список кругов", async () => {
    await dm(11, "/circles");
    const text = lastSent("sendMessage", 11)!.params.text;
    expect(text).toContain("Друзья");
    expect(text).toContain("Чат Бориса");
    await dm(12, "/circles");
    expect(lastSent("sendMessage", 12)!.params.text).not.toContain("Друзья");
  });
});

describe("каталог и видимость", () => {
  let drill: number;

  it("новая вещь объявляется в чате своего круга", async () => {
    const res = await call(11, "POST", "/items", {
      kind: "thing", direction: "offer", title: "Дрель Bosch", description: "Ударная, с набором свёрл", circleIds: [1], photoKeys: [],
    });
    expect(res.status).toBe(201);
    drill = res.json.id;
    const post = lastSent("sendMessage", -100)!;
    expect(post.params.text).toContain("Дрель Bosch");
    expect(post.params.reply_markup.inline_keyboard[0][0].url).toContain(`startapp=i${drill}`);
    expect(sent.some((s) => s.params.chat_id === -200 && s.params.text?.includes("Дрель"))).toBe(false);
  });

  it("вещь видят только участники её круга", async () => {
    expect((await call(12, "GET", "/items")).json.items.map((i: any) => i.id)).toContain(drill);
    expect((await call(13, "GET", "/items")).json.items).toEqual([]);
    expect((await call(13, "GET", `/items/${drill}`)).status).toBe(404);
    expect((await call(13, "POST", `/items/${drill}/requests`, {})).status).toBe(404);
    expect((await call(14, "GET", "/items")).json.items).toEqual([]);
  });

  it("нельзя опубликовать вещь в чужой круг или без круга", async () => {
    const base = { kind: "book", direction: "offer", title: "Книга", description: "", photoKeys: [] };
    expect((await call(13, "POST", "/items", { ...base, circleIds: [1] })).status).toBe(400);
    expect((await call(13, "POST", "/items", { ...base, circleIds: [] })).status).toBe(400);
  });

  it("поиск по-русски не зависит от регистра", async () => {
    expect((await call(12, "GET", `/items?q=${encodeURIComponent("дрель")}`)).json.items).toHaveLength(1);
    expect((await call(12, "GET", `/items?q=${encodeURIComponent("СВЁРЛ")}`)).json.items).toHaveLength(1);
    expect((await call(12, "GET", `/items?q=${encodeURIComponent("пила")}`)).json.items).toHaveLength(0);
    expect((await call(12, "GET", "/items?kind=book")).json.items).toHaveLength(0);
  });

  it("чужую вещь нельзя изменить или удалить", async () => {
    const body = { kind: "thing", direction: "offer", title: "Взлом", description: "", circleIds: [1], photoKeys: [] };
    expect((await call(12, "PUT", `/items/${drill}`, body)).status).toBe(404);
    expect((await call(12, "DELETE", `/items/${drill}`)).status).toBe(404);
  });

  it("скрытая вещь пропадает из каталога, но остаётся у владельца", async () => {
    const res = await call(11, "POST", "/items", {
      kind: "book", direction: "offer", title: "Скрытая книга", description: "", circleIds: [1], photoKeys: [], status: "hidden",
    });
    expect((await call(12, "GET", "/items")).json.items.map((i: any) => i.id)).not.toContain(res.json.id);
    expect((await call(12, "GET", `/items/${res.json.id}`)).status).toBe(404);
    expect((await call(11, "GET", "/items?mine=1")).json.items.map((i: any) => i.id)).toContain(res.json.id);
  });

  describe("запрос на вещь", () => {
    let borisReq: number;
    let glebReq: number;

    it("запрос уходит владельцу в личку с кнопками", async () => {
      const res = await call(12, "POST", `/items/${drill}/requests`, { message: "На выходные", dueDate: "2026-12-01" });
      expect(res.status).toBe(201);
      borisReq = res.json.id;
      const dm = lastSent("sendMessage", 11)!;
      expect(dm.params.text).toContain("Борис");
      expect(dm.params.text).toContain("01.12.2026");
      expect(dm.params.reply_markup.inline_keyboard[0][0].callback_data).toBe(`r:${borisReq}:accept`);
    });

    it("повторный запрос и запрос на свою вещь отклоняются", async () => {
      expect((await call(12, "POST", `/items/${drill}/requests`, {})).status).toBe(409);
      expect((await call(11, "POST", `/items/${drill}/requests`, {})).status).toBe(400);
    });

    it("посторонний и сам просящий не могут принять запрос", async () => {
      expect((await call(15, "POST", `/requests/${borisReq}/accept`)).status).toBe(403);
      expect((await call(12, "POST", `/requests/${borisReq}/accept`)).status).toBe(409);
    });

    it("владелец принимает кнопкой в боте: вещь занята, просящий уведомлён", async () => {
      glebReq = (await call(15, "POST", `/items/${drill}/requests`, {})).json.id;
      await handleUpdate(env, {
        callback_query: { id: "cq1", from: { id: 11, first_name: "Аня" }, data: `r:${borisReq}:accept`, message: { message_id: 5, chat: { id: 11, type: "private" } } },
      });
      const item = (await call(12, "GET", `/items/${drill}`)).json;
      expect(item.status).toBe("busy");
      expect(item.holder).toMatchObject({ name: "Борис", dueDate: "2026-12-01", status: "accepted" });
      expect(item.myRequest.status).toBe("accepted");
      expect(lastSent("sendMessage", 12)!.params.text).toContain("принят");
    });

    it("вторую заявку на занятую вещь принять нельзя", async () => {
      const res = await call(11, "POST", `/requests/${glebReq}/accept`);
      expect(res.status).toBe(409);
      expect((await call(11, "DELETE", `/items/${drill}`)).status).toBe(409);
    });

    it("передача и возврат: вещь снова свободна, всё записано в журнал", async () => {
      expect((await call(12, "POST", `/requests/${borisReq}/handover`)).status).toBe(409);
      expect((await call(11, "POST", `/requests/${borisReq}/handover`)).json.status).toBe("handed");
      expect(lastSent("sendMessage", 12)!.params.text).toContain("теперь у вас");
      expect((await call(12, "POST", `/requests/${borisReq}/cancel`)).status).toBe(409);
      expect((await call(11, "POST", `/requests/${borisReq}/complete`)).json.status).toBe("done");

      const item = (await call(15, "GET", `/items/${drill}`)).json;
      expect(item.status).toBe("available");
      expect(item.holder).toBeNull();

      const events = await env.DB.prepare(`SELECT type FROM events WHERE request_id = ?1 ORDER BY id`).bind(borisReq).all<{ type: string }>();
      expect(events.results.map((e) => e.type)).toEqual(["request_pending", "request_accepted", "request_handed", "request_done"]);
    });

    it("списки запросов: входящие у владельца, исходящие у просящего", async () => {
      const anna = (await call(11, "GET", "/requests")).json;
      expect(anna.incoming.map((r: any) => r.id).sort()).toEqual([borisReq, glebReq].sort());
      expect(anna.incoming[0].id).toBe(glebReq); // активные сверху
      const boris = (await call(12, "GET", "/requests")).json;
      expect(boris.outgoing).toHaveLength(1);
      expect(boris.outgoing[0]).toMatchObject({ status: "done", title: "Дрель Bosch", person: { name: "Аня" } });
    });
  });
});

describe("сообщения о новинках", () => {
  const item = (title: string, extra = {}) => ({ kind: "thing", direction: "offer", title, description: "", circleIds: [1], photoKeys: [], ...extra });
  const groupMsg = (userId: number, text: string, threadId?: number) =>
    handleUpdate(env, {
      message: {
        message_id: 7, chat: { id: -100, type: "supergroup", title: "Друзья" }, from: { id: userId, first_name: NAMES[userId] }, text,
        ...(threadId ? { message_thread_id: threadId, is_topic_message: true } : {}),
      },
    });

  it("без галочки вещь появляется в каталоге молча", async () => {
    const before = sent.length;
    const res = await call(11, "POST", "/items", item("Тихая вещь", { announce: false }));
    expect(res.status).toBe(201);
    expect(sent.slice(before).filter((s) => s.params.chat_id === -100)).toEqual([]);
    expect((await call(12, "GET", `/items?q=${encodeURIComponent("тихая")}`)).json.items).toHaveLength(1);
    // и при последующем редактировании тоже не объявляется
    await call(11, "PUT", `/items/${res.json.id}`, item("Тихая вещь 2"));
    expect(sent.slice(before).filter((s) => s.params.chat_id === -100)).toEqual([]);
  });

  it("/here в теме направляет новинки в эту тему; посторонний участник настроить не может", async () => {
    await groupMsg(15, "/here", 42);
    expect(lastSent("sendMessage", -100)!.params.text).toContain("администратор чата");
    await groupMsg(11, "/here@test_bot", 42);
    expect(lastSent("sendMessage", -100)!.params).toMatchObject({ message_thread_id: 42, text: "Новинки каталога буду присылать в эту тему." });

    await call(11, "POST", "/items", item("Вещь для темы"));
    expect(lastSent("sendMessage", -100)!.params).toMatchObject({ message_thread_id: 42 });
    expect(lastSent("sendMessage", -100)!.params.text).toContain("Вещь для темы");
  });

  it("/here вне тем возвращает новинки в общий чат", async () => {
    await groupMsg(11, "/here");
    await call(11, "POST", "/items", item("Вещь для общего чата"));
    expect(lastSent("sendMessage", -100)!.params.message_thread_id).toBeUndefined();
  });
});

describe("смена номера чата при включении тем", () => {
  it("круг переезжает на новый номер, а дубль, заведённый для нового номера, сливается с ним", async () => {
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      const method = String(url).split("/").pop()!;
      const params = JSON.parse(init.body);
      sent.push({ method, params });
      const result = method === "getChatMember" ? { status: chatMembers[params.chat_id]?.has(params.user_id) ? "member" : "left" } : true;
      return new Response(JSON.stringify({ ok: true, result }));
    });
    // Старая группа с кругом, участником и записью.
    chatMembers[-400] = new Set([11, 12]);
    await addBot(-400, "Соседи", 11);
    const old = (await env.DB.prepare(`SELECT id FROM circles WHERE chat_id = -400`).first<{ id: number }>())!;
    await call(11, "GET", "/me", undefined, `c${old.id}`);
    await call(12, "GET", "/me", undefined, `c${old.id}`);
    const item = (await call(11, "POST", "/items", { kind: "thing", direction: "offer", title: "Стремянка", description: "", circleIds: [old.id], photoKeys: [], announce: false })).json.id;

    // Включили темы: чат получил новый номер, бот увидел себя в нём раньше сообщения о переезде и завёл дубль.
    chatMembers[-4009] = new Set([11, 12]);
    await addBot(-4009, "Соседи", 11);
    const dup = (await env.DB.prepare(`SELECT id FROM circles WHERE chat_id = -4009`).first<{ id: number }>())!;
    await env.DB.prepare(`UPDATE circles SET thread_id = 77 WHERE id = ?1`).bind(dup.id).run(); // /here уже выполнили в новом чате

    await handleUpdate(env, { message: { message_id: 1, chat: { id: -400, type: "group", title: "Соседи" }, migrate_to_chat_id: -4009 } });

    const circles = await env.DB.prepare(`SELECT id, chat_id, thread_id FROM circles WHERE chat_id IN (-400, -4009)`).all<any>();
    expect(circles.results).toEqual([{ id: dup.id, chat_id: -4009, thread_id: 77 }]);
    // Запись и участник переехали вместе с кругом.
    expect((await call(12, "GET", `/items/${item}`)).status).toBe(200);
    expect((await call(12, "GET", "/me")).json.circles.map((c: any) => c.id)).toContain(dup.id);

    // Новинка доходит в тему нового чата.
    await call(11, "POST", "/items", { kind: "thing", direction: "offer", title: "После переезда", description: "", circleIds: [dup.id], photoKeys: [] });
    expect(lastSent("sendMessage", -4009)!.params).toMatchObject({ message_thread_id: 77 });

    // Второе сообщение о переезде (из нового чата) ничего не ломает.
    await handleUpdate(env, { message: { message_id: 2, chat: { id: -4009, type: "supergroup", title: "Соседи" }, migrate_from_chat_id: -400 } });
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM circles WHERE chat_id = -4009`).first<{ n: number }>())!.n).toBe(1);
  });

  it("если сообщение о переезде пришло первым, круг просто получает новый номер", async () => {
    chatMembers[-500] = new Set([11]);
    await addBot(-500, "Клуб", 11);
    const id = (await env.DB.prepare(`SELECT id FROM circles WHERE chat_id = -500`).first<{ id: number }>())!.id;
    await handleUpdate(env, { message: { message_id: 1, chat: { id: -500, type: "group", title: "Клуб" }, migrate_to_chat_id: -5009 } });
    await addBot(-5009, "Клуб", 11); // бот увидел себя в новом чате — круг уже есть, дубля нет
    const rows = await env.DB.prepare(`SELECT id FROM circles WHERE chat_id IN (-500, -5009)`).all<{ id: number }>();
    expect(rows.results).toEqual([{ id }]);
  });
});

describe("языки", () => {
  const stub = () =>
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      const method = String(url).split("/").pop()!;
      const params = JSON.parse(init.body);
      sent.push({ method, params });
      const result = method === "getChatMember" ? { status: chatMembers[params.chat_id]?.has(params.user_id) ? "member" : "left" } : true;
      return new Response(JSON.stringify({ ok: true, result }));
    });
  const press = (userId: number, data: string, chatId: number, type: "private" | "supergroup") =>
    handleUpdate(env, { callback_query: { id: "cq", from: { id: userId, first_name: NAMES[userId] }, data, message: { message_id: 3, chat: { id: chatId, type } } } });

  it("по умолчанию английский; русский — тем, у кого Telegram на русском", async () => {
    stub();
    const dana = await call(16, "GET", "/me", undefined, "c1");
    expect(dana.json.lang).toBe("en");
    expect(dana.json.circles).toHaveLength(1);
    expect((await call(11, "GET", "/me")).json.lang).toBe("ru");
    expect((await call(16, "GET", "/items/99999")).json.error).toBe("Listing not found or not available to you");
    expect((await call(11, "GET", "/items/99999")).json.error).toBe("Запись не найдена или недоступна вам");
  });

  it("язык переключается в приложении, и уведомления приходят на языке получателя", async () => {
    expect((await call(16, "PUT", "/lang", { lang: "de" })).status).toBe(400);
    const id = (await call(16, "POST", "/items", { kind: "book", direction: "offer", title: "Dune", description: "", circleIds: [1], photoKeys: [] })).json.id;
    const req = (await call(12, "POST", `/items/${id}/requests`, { dueDate: "2026-12-05" })).json.id;
    expect(lastSent("sendMessage", 16)!.params.text).toContain("is asking for “Dune”");
    expect(lastSent("sendMessage", 16)!.params.text).toContain("5 Dec 2026");

    expect((await call(16, "PUT", "/lang", { lang: "ru" })).json.lang).toBe("ru");
    expect((await call(16, "GET", "/me")).json.lang).toBe("ru");
    await call(16, "POST", `/requests/${req}/accept`);
    expect(lastSent("sendMessage", 12)!.params.text).toContain("принят"); // Борису — по-русски
    await call(12, "POST", `/requests/${req}/cancel`);
    expect(lastSent("sendMessage", 16)!.params.text).toContain("отменён"); // Дане — уже по-русски
  });

  it("/lang в личке меняет язык кнопкой", async () => {
    await dm(16, "/lang");
    expect(lastSent("sendMessage", 16)!.params.reply_markup.inline_keyboard[0].map((b: any) => b.callback_data)).toEqual(["lang:en", "lang:ru"]);
    await press(16, "lang:en", 16, "private");
    expect((await call(16, "GET", "/me")).json.lang).toBe("en");
    expect(lastSent("editMessageText", 16)!.params.text).toContain("English");
  });

  it("язык чата меняет только его администратор или создатель круга", async () => {
    await press(16, "lang:en", -100, "supergroup");
    await call(11, "POST", "/items", { kind: "thing", direction: "offer", title: "Проверка языка", description: "", circleIds: [1], photoKeys: [] });
    expect(lastSent("sendMessage", -100)!.params.text).toContain("предлагаю");

    await press(11, "lang:en", -100, "supergroup");
    await call(11, "POST", "/items", { kind: "thing", direction: "offer", title: "Language check", description: "", circleIds: [1], photoKeys: [] });
    expect(lastSent("sendMessage", -100)!.params.text).toContain("Item · offered");
    expect(lastSent("sendMessage", -100)!.params.reply_markup.inline_keyboard[0][0].text).toBe("View");
    await press(11, "lang:ru", -100, "supergroup");
  });
});

describe("помощь", () => {
  it("помощь не блокируется одним запросом и завершается без передачи", async () => {
    const id = (await call(11, "POST", "/items", {
      kind: "help", direction: "offer", title: "Помогу с Excel", description: "", circleIds: [1], photoKeys: [],
    })).json.id;
    const r1 = (await call(12, "POST", `/items/${id}/requests`, {})).json.id;
    const r2 = (await call(15, "POST", `/items/${id}/requests`, {})).json.id;
    expect((await call(11, "POST", `/requests/${r1}/accept`)).json.status).toBe("accepted");
    expect((await call(11, "POST", `/requests/${r2}/accept`)).json.status).toBe("accepted");
    expect((await call(12, "GET", `/items/${id}`)).json.status).toBe("available");
    expect((await call(11, "POST", `/requests/${r1}/handover`)).status).toBe(409);
    expect((await call(12, "POST", `/requests/${r1}/complete`)).json.status).toBe("done");
  });
});

describe("бот", () => {
  it("фото с подписью в личку превращается в черновик", async () => {
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      if (String(url).includes("/file/bot")) return new Response(new Uint8Array([0xff, 0xd8, 0xff]));
      const method = String(url).split("/").pop()!;
      const params = JSON.parse(init.body);
      sent.push({ method, params });
      return new Response(JSON.stringify({ ok: true, result: method === "getFile" ? { file_path: "photos/1.jpg" } : true }));
    });
    await handleUpdate(env, {
      message: {
        message_id: 9, chat: { id: 13, type: "private" }, from: { id: 13, first_name: "Вера" },
        caption: "Палатка двухместная\nЛёгкая, 2 кг", photo: [{ file_id: "small" }, { file_id: "big" }],
      },
    });
    const mine = (await call(13, "GET", "/items?mine=1")).json.items;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: "Палатка двухместная", status: "draft" });
    expect(mine[0].photo).toMatch(/\.jpg$/);
    expect((await env.PHOTOS.get(mine[0].photo))).not.toBeNull();
    const reply = lastSent("sendMessage", 13)!;
    expect(reply.params.reply_markup.inline_keyboard[0][0].web_app.url).toBe(`https://app.test/?go=${encodeURIComponent(`/edit/${mine[0].id}`)}`);

    // Публикация черновика объявляет его в чате
    const pub = await call(13, "PUT", `/items/${mine[0].id}`, {
      kind: "thing", direction: "offer", title: "Палатка двухместная", description: "Лёгкая, 2 кг", circleIds: [2], photoKeys: [mine[0].photo],
    });
    expect(pub.status).toBe(200);
    expect(sent.some((s) => s.method === "sendPhoto" && s.params.chat_id === -200)).toBe(true);
    expect((await call(11, "GET", "/items?circle=2")).json.items.map((i: any) => i.title)).toEqual(["Палатка двухместная"]);
  });

  it("вышедший из чата теряет доступ к кругу после перепроверки", async () => {
    chatMembers[-100].delete(15);
    vi.stubGlobal("fetch", async (_url: string, init: any) => {
      const params = JSON.parse(init.body);
      return new Response(JSON.stringify({ ok: true, result: { status: chatMembers[params.chat_id]?.has(params.user_id) ? "member" : "left" } }));
    });
    await env.DB.prepare(`UPDATE memberships SET checked_at = datetime('now', '-2 days') WHERE user_id = 15`).run();
    expect((await call(15, "GET", "/me")).json.circles).toEqual([]);
    expect((await call(15, "GET", "/items")).json.items).toEqual([]);
  });

  it("бота убрали из чата — круг и его вещи скрываются", async () => {
    await handleUpdate(env, {
      my_chat_member: { chat: { id: -200, type: "supergroup", title: "Книжный клуб" }, from: { id: 11, first_name: "Аня" }, new_chat_member: { status: "kicked" } },
    });
    expect((await call(13, "GET", "/me")).json.circles).toEqual([]);
    expect((await call(11, "GET", "/items?circle=2")).json.items).toEqual([]);
  });
});

describe("наблюдение за доменом", () => {
  it("разбирает ответ реестра", () => {
    const ev = [{ eventAction: "expiration", eventDate: "2026-09-11T09:25:43Z" }];
    expect(parseRdap(404, null)).toEqual({ kind: "available", expires: null });
    expect(parseRdap(200, { status: ["pending delete", "redemption period"], events: ev })).toEqual({ kind: "redemption", expires: "2026-09-11" });
    expect(parseRdap(200, { status: ["pending delete"], events: ev })?.kind).toBe("pendingDelete");
    expect(parseRdap(200, { status: ["client transfer prohibited"], events: ev })?.kind).toBe("registered");
    expect(parseRdap(503, null)).toBeNull();
  });

  it("пишет админу только при смене состояния", async () => {
    let rdap: { status: number; body: unknown } = { status: 200, body: { status: ["redemption period"], events: [] } };
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      if (String(url).startsWith("https://rdap.org/")) return new Response(JSON.stringify(rdap.body), { status: rdap.status });
      sent.push({ method: String(url).split("/").pop()!, params: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: true }));
    });
    const e = { ...env, WATCH_DOMAINS: "example.app" };
    const toAdmin = () => sent.filter((s) => s.params.chat_id === 11 && s.params.text?.includes("example.app"));

    await watchDomains(e);
    expect(toAdmin()).toHaveLength(1);
    expect(toAdmin()[0].params.text).toContain("выкуп");

    await watchDomains(e); // ничего не изменилось — молчим
    expect(toAdmin()).toHaveLength(1);

    rdap = { status: 503, body: null }; // реестр сбоит — тоже молчим
    await watchDomains(e);
    expect(toAdmin()).toHaveLength(1);

    rdap = { status: 404, body: null };
    await watchDomains(e);
    expect(toAdmin()).toHaveLength(2);
    expect(toAdmin()[1].params.text).toContain("свободен");
    // Обычным участникам не пишем
    expect(sent.some((s) => s.params.chat_id === 12 && s.params.text?.includes("example.app"))).toBe(false);
  });
});

describe("несколько записей в круг разом", () => {
  let circleId = 0;

  it("добавляет только свои записи и только в свои круги", async () => {
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      const method = String(url).split("/").pop()!;
      const params = JSON.parse(init.body);
      sent.push({ method, params });
      const result = method === "getChatMember" ? { status: chatMembers[params.chat_id]?.has(params.user_id) ? "member" : "left" } : true;
      return new Response(JSON.stringify({ ok: true, result }));
    });
    // Новый чат «Пряники»: Аня и Вера. Старые записи Ани сами туда не попадают.
    chatMembers[-700] = new Set([11, 13]);
    await addBot(-700, "Пряники", 11);
    circleId = (await env.DB.prepare(`SELECT id FROM circles WHERE chat_id = -700`).first<{ id: number }>())!.id;
    for (const u of [11, 13]) await call(u, "GET", "/me", undefined, `c${circleId}`);

    const base = { kind: "thing", direction: "offer", description: "", photoKeys: [], announce: false };
    const a = (await call(11, "POST", "/items", { ...base, title: "Палатка", circleIds: [1] })).json.id;
    const b = (await call(11, "POST", "/items", { ...base, title: "Спальник", circleIds: [1] })).json.id;
    const foreign = (await call(12, "POST", "/items", { ...base, title: "Чужая лодка", circleIds: [1] })).json.id;

    const mine = await call(11, "GET", "/items?mine=1");
    expect(mine.json.items.find((it: any) => it.id === a).circleIds).toEqual([1]);
    expect((await call(13, "GET", `/items?circle=${circleId}`)).json.items).toEqual([]);

    const res = await call(11, "POST", `/circles/${circleId}/items`, { itemIds: [a, b, foreign] });
    expect(res.json.added).toBe(2);
    // Чужая запись в круг не попала, а свои видны участнице Вере
    const forVera = (await call(13, "GET", `/items?circle=${circleId}`)).json.items.map((it: any) => it.title);
    expect(forVera.sort()).toEqual(["Палатка", "Спальник"]);
    // Повтор ничего не дублирует
    expect((await call(11, "POST", `/circles/${circleId}/items`, { itemIds: [a] })).json.added).toBe(0);
    // В чужой круг нельзя: Борис в «Пряниках» не состоит
    expect((await call(12, "POST", `/circles/${circleId}/items`, { itemIds: [foreign] })).status).toBe(403);
  });

  it("каталог из кнопки в чате открывается на этом круге", async () => {
    expect((await call(11, "GET", "/me", undefined, `c${circleId}`)).json.openCircle).toBe(circleId);
    expect((await call(11, "GET", "/me")).json.openCircle).toBeNull();
  });
});
