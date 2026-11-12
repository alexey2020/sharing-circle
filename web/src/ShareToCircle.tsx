import { useMemo, useState } from "react";
import { alertDialog, api, type ItemCard, type Me } from "./api";
import { catalogFilters } from "./Catalog";
import { t } from "./i18n";
import { kindEmoji } from "./strings";
import { Badge, Chips, go, useLoad } from "./ui";

/** Добавить сразу несколько своих записей в круг — удобно, когда бота добавили в новый чат. */
export function ShareToCircle({ me }: { me: Me }) {
  const { data, error: loadError } = useLoad(() => api.items({ mine: "1" }), []);
  const [circle, setCircle] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = data?.items ?? [];
  // По умолчанию — круг из фильтра каталога, иначе тот, где ваших записей меньше всего (обычно новый).
  const defaultCircle = useMemo(() => {
    if (me.circles.some((c) => String(c.id) === catalogFilters.circle)) return catalogFilters.circle;
    const count = (id: number) => items.filter((it) => it.circleIds?.includes(id)).length;
    return String([...me.circles].sort((a, b) => count(a.id) - count(b.id))[0]?.id ?? "");
  }, [me.circles, items]);
  const circleId = Number(circle ?? defaultCircle);
  const circleTitle = me.circles.find((c) => c.id === circleId)?.title ?? "";

  const candidates = items.filter((it) => !it.circleIds?.includes(circleId));
  // Отмечены опубликованные записи; черновики и скрытые — по желанию.
  const defaultPicked = (list: ItemCard[]) => new Set(list.filter((it) => it.status === "available" || it.status === "busy").map((it) => it.id));
  const selected = picked ?? defaultPicked(candidates);

  const changeCircle = (v: string) => {
    setCircle(v);
    setPicked(null);
    setError(null);
  };
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const { added } = await api.addToCircle(circleId, [...selected]);
      await alertDialog(t.share.done(added, circleTitle));
      go("/mine");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="form">
      <h1>{t.share.open}</h1>
      <p className="hint">{t.share.hint}</p>
      <Chips value={String(circleId)} onChange={changeCircle} options={me.circles.map((c) => ({ value: String(c.id), label: c.title }))} />
      {loadError && <p className="error">{loadError}</p>}
      {data && candidates.length === 0 && <p className="notice">{t.share.allThere}</p>}
      {candidates.length > 0 && (
        <>
          <div className="row share-tools">
            <button type="button" className="link" onClick={() => setPicked(new Set(candidates.map((it) => it.id)))}>
              {t.share.selectAll}
            </button>
            <button type="button" className="link" onClick={() => setPicked(new Set())}>
              {t.share.selectNone}
            </button>
          </div>
          {candidates.map((it) => (
            <label key={it.id} className="check">
              <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
              <span>
                {kindEmoji[it.kind]} {it.title}{" "}
                {(it.status === "draft" || it.status === "hidden") && <Badge>{t.itemStatus[it.status]}</Badge>}
              </span>
            </label>
          ))}
          {error && <p className="error">{error}</p>}
          <button className="btn primary wide" disabled={saving || selected.size === 0} onClick={submit}>
            {t.share.button(selected.size)}
          </button>
        </>
      )}
    </div>
  );
}
