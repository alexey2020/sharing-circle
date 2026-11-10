import type { TgUser } from "./types";

const enc = new TextEncoder();

async function hmac(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

async function computeHash(fields: [string, string][], botToken: string): Promise<string> {
  const dataCheck = fields
    .filter(([k]) => k !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  return toHex(await hmac(secret, dataCheck));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface InitData {
  user: TgUser;
  startParam?: string;
}

/**
 * Проверяет подпись initData, которую Telegram передаёт в Mini App.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400,
  nowMs = Date.now(),
): Promise<InitData | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!hash || !authDate || !userRaw) return null;

  const expected = await computeHash([...params.entries()], botToken);
  if (!safeEqual(expected, hash)) return null;
  if (nowMs / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(userRaw) as TgUser;
    if (typeof user.id !== "number" || typeof user.first_name !== "string") return null;
    return { user, startParam: params.get("start_param") ?? undefined };
  } catch {
    return null;
  }
}

/** Собирает подписанную строку initData. Нужна только для тестов. */
export async function signInitData(fields: Record<string, string>, botToken: string): Promise<string> {
  const hash = await computeHash(Object.entries(fields), botToken);
  return new URLSearchParams({ ...fields, hash }).toString();
}
