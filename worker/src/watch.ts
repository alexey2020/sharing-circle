import { formatDate, type Lang } from "./i18n";
import { sendMessage } from "./telegram";
import type { Env } from "./types";

/**
 * Наблюдение за занятыми доменами (WATCH_DOMAINS в wrangler.toml, через запятую).
 * Раз в час спрашиваем реестр по протоколу RDAP и пишем администраторам в личку, когда состояние меняется:
 * владелец не продлил → идёт выкуп → удаление → домен свободен.
 */

type Kind = "registered" | "redemption" | "pendingDelete" | "available";
export interface DomainState {
  kind: Kind;
  expires: string | null; // YYYY-MM-DD
}

/** Разбор ответа RDAP. null — реестр не ответил толком, состояние неизвестно. */
export function parseRdap(status: number, body: any): DomainState | null {
  if (status === 404) return { kind: "available", expires: null };
  if (status !== 200 || !body) return null;
  const flags: string[] = (body.status ?? []).map((s: string) => s.toLowerCase());
  const exp = (body.events ?? []).find((e: any) => e.eventAction === "expiration")?.eventDate ?? null;
  const kind: Kind = flags.includes("redemption period") ? "redemption" : flags.includes("pending delete") ? "pendingDelete" : "registered";
  return { kind, expires: exp ? String(exp).slice(0, 10) : null };
}

const REGISTER_URL = "https://dash.cloudflare.com/?to=/:account/domains/register";

const texts: Record<Lang, Record<Kind, (d: string, exp: string | null) => string>> = {
  ru: {
    available: (d) => `🎉 Домен <b>${d}</b> свободен! Регистрируйте, пока не заняли: ${REGISTER_URL}`,
    pendingDelete: (d) => `⌛ <b>${d}</b> в очереди на удаление — освободится в ближайшие дни. Сообщу, как только станет свободен.`,
    redemption: (d, exp) =>
      `⏳ <b>${d}</b>: владелец не продлил домен${exp ? ` (срок истёк ${exp})` : ""}. Идёт период выкупа — если владелец его не выкупит, через несколько недель домен освободится. Сообщу о каждом изменении.`,
    registered: (d, exp) => `🔒 <b>${d}</b> зарегистрирован${exp ? `, оплачен до ${exp}` : ""}. Слежу дальше.`,
  },
  en: {
    available: (d) => `🎉 <b>${d}</b> is available! Register it before someone else does: ${REGISTER_URL}`,
    pendingDelete: (d) => `⌛ <b>${d}</b> is pending deletion and will be released within days. I'll tell you as soon as it's free.`,
    redemption: (d, exp) =>
      `⏳ <b>${d}</b>: the owner did not renew it${exp ? ` (expired ${exp})` : ""}. It is in the redemption period — unless the owner redeems it, it will be released in a few weeks. I'll report every change.`,
    registered: (d, exp) => `🔒 <b>${d}</b> is registered${exp ? `, paid until ${exp}` : ""}. Still watching.`,
  },
};

export async function watchDomains(env: Env): Promise<void> {
  const domains = (env.WATCH_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  if (!domains.length) return;

  const { results: admins } = await env.DB.prepare(`SELECT id, lang FROM users WHERE is_admin = 1`).all<{ id: number; lang: string | null }>();

  for (const domain of domains) {
    let state: DomainState | null = null;
    try {
      // rdap.org перенаправляет на реестр нужной зоны; без User-Agent он отвечает 403.
      const res = await fetch(`https://rdap.org/domain/${domain}`, {
        headers: { accept: "application/rdap+json", "user-agent": "share-circle-bot (domain watch)" },
      });
      state = parseRdap(res.status, res.status === 200 ? await res.json() : null);
      if (!state) console.error(JSON.stringify({ msg: "rdap unexpected status", domain, status: res.status }));
    } catch (e) {
      console.error(JSON.stringify({ msg: "rdap failed", domain, error: String(e) }));
    }
    if (!state) continue;

    const key = `${state.kind}|${state.expires ?? ""}`;
    const prev = await env.DB.prepare(`SELECT state FROM domain_watch WHERE domain = ?1`).bind(domain).first<{ state: string }>();
    await env.DB.prepare(
      `INSERT INTO domain_watch (domain, state) VALUES (?1, ?2)
       ON CONFLICT(domain) DO UPDATE SET state = excluded.state, checked_at = datetime('now')`,
    )
      .bind(domain, key)
      .run();
    if (prev?.state === key) continue;

    for (const a of admins) {
      const lang: Lang = a.lang === "en" ? "en" : "ru";
      const exp = state.expires ? formatDate(state.expires, lang) : null;
      await sendMessage(env, a.id, texts[lang][state.kind](domain, exp));
    }
  }
}
