import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { api, hasAuth, tgApp, type Me } from "./api";
import { Catalog, Mine } from "./Catalog";
import { ItemForm } from "./ItemForm";
import { ItemPage } from "./ItemPage";
import { Landing } from "./Landing";
import { Requests } from "./Requests";
import { setLang, t, useLang } from "./i18n";
import { Empty, go, useHash, useLoad } from "./ui";
import "./styles.css";

// Кнопки бота открывают нужный экран через ?go=/item/5: hash для этого не годится, его занимает Telegram.
{
  const params = new URLSearchParams(location.search);
  const target = params.get("go");
  params.delete("go");
  const search = params.size ? `?${params}` : "";
  if (target?.startsWith("/")) history.replaceState(null, "", `${location.pathname}${search}#${target}`);
  else if (!location.hash.startsWith("#/")) history.replaceState(null, "", `${location.pathname}${search}#/`);
}

const TABS = [
  { path: "/", key: "catalog", icon: "🗂" },
  { path: "/requests", key: "requests", icon: "🙋" },
  { path: "/mine", key: "mine", icon: "📦" },
] as const;

function App() {
  const hash = useHash();
  useLang(); // перерисовываем всё приложение при смене языка
  const { data: me, error } = useLoad<Me | null>(() => (hasAuth ? api.me() : Promise.resolve(null)), []);
  const isTab = TABS.some((tab) => tab.path === hash);

  // Язык хранится на сервере, чтобы интерфейс и бот говорили на одном.
  useEffect(() => {
    if (me) setLang(me.lang);
  }, [me]);

  useEffect(() => {
    tgApp?.ready?.();
    tgApp?.expand?.();
  }, []);

  // Переход по ссылке на конкретную вещь из чата
  useEffect(() => {
    if (me?.openItem && hash === "/") go(`/item/${me.openItem}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.openItem]);

  // Без разрешения писать в личку бот не сможет присылать уведомления о запросах
  useEffect(() => {
    if (me && tgApp?.initDataUnsafe?.user && !tgApp.initDataUnsafe.user.allows_write_to_pm) {
      tgApp.requestWriteAccess?.();
    }
  }, [me]);

  useEffect(() => {
    const back = tgApp?.BackButton;
    if (!back) return;
    const onBack = () => (history.length > 1 ? history.back() : go("/"));
    if (isTab) back.hide();
    else back.show();
    back.onClick(onBack);
    return () => back.offClick(onBack);
  }, [isTab]);

  if (!hasAuth) return <Landing />;
  if (error) return <Empty title={t.errLogin}>{error}</Empty>;
  if (!me) return null;

  const item = /^\/item\/(\d+)$/.exec(hash);
  const edit = /^\/edit\/(\d+)$/.exec(hash);

  let page;
  if (item) page = <ItemPage key={item[1]} id={Number(item[1])} />;
  else if (edit) page = <ItemForm key={edit[1]} me={me} id={Number(edit[1])} />;
  else if (hash === "/new") page = <ItemForm me={me} />;
  else if (hash === "/requests") page = <Requests />;
  else if (hash === "/mine") page = <Mine />;
  else page = <Catalog me={me} />;

  return (
    <>
      <main className={isTab ? "with-tabs" : ""}>
        {!isTab && !tgApp?.initData && (
          <button className="back" onClick={() => history.back()}>
            {t.back}
          </button>
        )}
        {page}
      </main>
      {isTab && (
        <>
          {me.circles.length > 0 && hash !== "/requests" && (
            <a className="fab" href="#/new" aria-label={t.add}>
              +
            </a>
          )}
          <nav className="tabs">
            {TABS.map((tab) => (
              <a key={tab.path} href={`#${tab.path}`} className={tab.path === hash ? "on" : ""}>
                <span aria-hidden>{tab.icon}</span>
                {t.tabs[tab.key]}
              </a>
            ))}
          </nav>
        </>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
