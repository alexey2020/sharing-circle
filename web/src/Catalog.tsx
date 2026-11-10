import { useEffect, useState } from "react";
import { api, type Me } from "./api";
import { t, useLang } from "./i18n";
import { termsText } from "./termsText";
import { KINDS, type Direction, type Kind } from "./strings";
import { Chips, Empty, ItemGrid, LangSwitch, useLoad } from "./ui";

export function Catalog({ me }: { me: Me }) {
  const [kind, setKind] = useState<Kind | "all">("all");
  const [direction, setDirection] = useState<Direction | "all">("all");
  const [circle, setCircle] = useState("all");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const { data, error } = useLoad(() => {
    const params: Record<string, string> = {};
    if (kind !== "all") params.kind = kind;
    if (direction !== "all") params.direction = direction;
    if (circle !== "all") params.circle = circle;
    if (query) params.q = query;
    return api.items(params);
  }, [kind, direction, circle, query]);

  if (me.circles.length === 0) {
    return (
      <Empty title={t.noCirclesTitle}>
        <p>{t.noCirclesWhat}</p>
        <p>{me.canCreate ? t.noCirclesCreate(me.botUsername) : t.noCirclesInvite}</p>
        <p>{t.noCirclesAlready}</p>
      </Empty>
    );
  }

  const filtered = kind !== "all" || direction !== "all" || circle !== "all" || !!query;

  return (
    <>
      <div className="row search">
        <input type="search" placeholder={t.search} value={text} onChange={(e) => setText(e.target.value)} />
        {me.circles.length > 1 && (
          <select value={circle} onChange={(e) => setCircle(e.target.value)} aria-label={t.circle}>
            <option value="all">{t.allCircles}</option>
            {me.circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <Chips value={kind} onChange={setKind} options={[{ value: "all" as const, label: t.all }, ...KINDS.map((k) => ({ value: k, label: t.kindPlural[k] }))]} />
      <Chips
        value={direction}
        onChange={setDirection}
        options={[
          { value: "all", label: t.anyDirection },
          { value: "offer", label: t.offered },
          { value: "want", label: t.wanted },
        ]}
      />

      {error && <p className="error">{error}</p>}
      {data && data.items.length === 0 && (
        <Empty title={filtered ? t.emptyFiltered : t.emptyCatalog}>
          <p>{filtered ? t.emptyFilteredHint : t.emptyCatalogHint}</p>
        </Empty>
      )}
      {data && <ItemGrid items={data.items} />}
    </>
  );
}

export function Mine() {
  const lang = useLang();
  const { data, error } = useLoad(() => api.items({ mine: "1" }), []);
  return (
    <>
      <div className="row">
        <h1>{t.tabs.mine}</h1>
        <LangSwitch />
      </div>
      {error && <p className="error">{error}</p>}
      {data && data.items.length === 0 && (
        <Empty title={t.mineEmpty}>
          <p>{t.mineEmptyHint}</p>
        </Empty>
      )}
      {data && <ItemGrid items={data.items} showStatus />}
      <p className="terms-link">
        <a href="#/terms">{termsText(lang).link}</a>
      </p>
    </>
  );
}
