import { useEffect, useState } from "react";
import { api, photoUrl, shrinkPhoto, type ItemInput, type Me } from "./api";
import { t } from "./i18n";
import { KINDS, type Direction, type Kind } from "./strings";
import { Chips, go } from "./ui";
import { catalogFilters } from "./Catalog";

const MAX_PHOTOS = 6;

export function ItemForm({ me, id }: { me: Me; id?: number }) {
  const [loaded, setLoaded] = useState(!id);
  // Новая запись начинается с той категории и того круга, что выбраны в каталоге.
  const [kind, setKind] = useState<Kind>(!id && catalogFilters.kind !== "all" ? catalogFilters.kind : "thing");
  const [direction, setDirection] = useState<Direction>(!id && catalogFilters.direction !== "all" ? catalogFilters.direction : "offer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [circleIds, setCircleIds] = useState<number[]>(() => {
    if (me.circles.length === 1) return [me.circles[0].id];
    const picked = me.circles.find((c) => String(c.id) === catalogFilters.circle);
    return !id && picked ? [picked.id] : [];
  });
  const [visible, setVisible] = useState(true);
  // О новинке сообщаем один раз — при первой публикации, поэтому галочка есть только у новых записей и черновиков.
  const [canAnnounce, setCanAnnounce] = useState(!id);
  const [announce, setAnnounce] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.item(id).then(
      (item) => {
        setKind(item.kind);
        setDirection(item.direction);
        setTitle(item.title === "Без названия" || item.title === "Untitled" ? "" : item.title);
        setDescription(item.description);
        setPhotos(item.photos);
        if (item.circles.length) setCircleIds(item.circles.map((c) => c.id));
        setVisible(item.status !== "hidden");
        setCanAnnounce(item.status === "draft");
        setLoaded(true);
      },
      (e) => setError(e.message),
    );
  }, [id]);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const key = await api.uploadPhoto(await shrinkPhoto(file));
        setPhotos((p) => [...p, key]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const toggleCircle = (cid: number) => setCircleIds((ids) => (ids.includes(cid) ? ids.filter((x) => x !== cid) : [...ids, cid]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t.needTitle);
    if (circleIds.length === 0) return setError(t.needCircle);
    setSaving(true);
    setError(null);
    const input: ItemInput = {
      kind,
      direction,
      title: title.trim(),
      description: description.trim(),
      status: visible ? "available" : "hidden",
      circleIds,
      photoKeys: photos,
      announce,
    };
    try {
      const saved = id ? await api.updateItem(id, input) : await api.createItem(input);
      location.replace(`#/item/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  if (me.circles.length === 0) {
    return <p className="notice">{t.needCircleFirst}</p>;
  }
  if (!loaded) return error ? <p className="error">{error}</p> : null;

  return (
    <form className="form" onSubmit={save}>
      <h1>{id ? t.editing : t.newEntry}</h1>

      <Chips
        value={direction}
        onChange={setDirection}
        options={(["offer", "want"] as Direction[]).map((d) => ({ value: d, label: t.direction[d] }))}
      />
      <Chips value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t.kind[k] }))} />

      <label>
        {t.title}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder={placeholder(kind, direction)} />
      </label>
      <label>
        {t.description}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder={t.descriptionPlaceholder} />
      </label>

      <div>
        <div className="label">{t.photos}</div>
        <div className="thumbs">
          {photos.map((p) => (
            <div key={p} className="thumb">
              <img src={photoUrl(p)} alt="" />
              <button type="button" aria-label={t.removePhoto} onClick={() => setPhotos((list) => list.filter((x) => x !== p))}>
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="thumb add">
              {uploading ? "…" : "+"}
              <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>

      <div>
        <div className="label">{t.visibleTo}</div>
        {me.circles.map((c) => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={circleIds.includes(c.id)} onChange={() => toggleCircle(c.id)} />
            {c.title}
          </label>
        ))}
      </div>

      <label className="check">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        {t.showInCatalog}
      </label>
      {canAnnounce && visible && (
        <label className="check">
          <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
          {t.announce}
        </label>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="btn primary wide" disabled={saving || uploading}>
          {visible ? t.publish : t.save}
        </button>
        <button type="button" className="btn" onClick={() => (id ? go(`/item/${id}`) : history.back())}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function placeholder(kind: Kind, direction: Direction): string {
  const p = t.placeholder;
  if (direction === "want") return kind === "book" ? p.want.book : p.want.other;
  return p.offer[kind];
}
