import { useEffect, useState, type ReactNode } from "react";
import { api, hasAuth, photoUrl, type ItemCard } from "./api";
import { LANGS, setLang, t, useLang, type Lang } from "./i18n";
import { kindEmoji } from "./strings";

/** Telegram дописывает в hash свои данные (#tgWebAppData=…), поэтому путём считаем только то, что начинается с «/». */
function currentPath(): string {
  const h = location.hash.slice(1);
  return h.startsWith("/") ? h : "/";
}

export function useHash(): string {
  const [hash, setHash] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setHash(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export const go = (path: string) => {
  location.hash = path;
};

/** Загрузка данных с состояниями «грузится / ошибка» и возможностью обновить. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    load().then(
      (d) => alive && setData(d),
      (e) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((n) => n + 1) };
}

/** Переключатель языка. Внутри Telegram выбор сохраняется на сервере, чтобы на нём же писал бот. */
export function LangSwitch() {
  const lang = useLang();
  const choose = (next: Lang) => {
    setLang(next);
    if (hasAuth) api.setLang(next).catch(() => {});
  };
  return (
    <div className="lang-switch" role="group" aria-label={t.language}>
      {LANGS.map((l) => (
        <button key={l} type="button" className={l === lang ? "on" : ""} aria-pressed={l === lang} onClick={() => choose(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {props.options.map((o) => (
        <button key={o.value} type="button" className={o.value === props.value ? "chip on" : "chip"} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge(props: { tone?: "muted" | "warn" | "accent"; children: ReactNode }) {
  return <span className={`badge ${props.tone ?? "muted"}`}>{props.children}</span>;
}

export function Empty(props: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{props.title}</p>
      {props.children && <div className="hint">{props.children}</div>}
    </div>
  );
}

export function ItemGrid(props: { items: ItemCard[]; showStatus?: boolean }) {
  return (
    <div className="grid">
      {props.items.map((it) => (
        <a key={it.id} className="card" href={`#/item/${it.id}`}>
          <div className="card-photo">
            {it.photo ? <img src={photoUrl(it.photo)} alt="" loading="lazy" /> : <span>{kindEmoji[it.kind]}</span>}
            <div className="card-badges">
              {it.direction === "want" && <Badge tone="accent">{t.wantBadge}</Badge>}
              {(it.status === "busy" || (props.showStatus && it.status !== "available")) && <Badge tone="warn">{t.itemStatus[it.status]}</Badge>}
            </div>
          </div>
          <div className="card-title">{it.title}</div>
          {!props.showStatus && <div className="hint">{it.ownerName}</div>}
        </a>
      ))}
    </div>
  );
}
