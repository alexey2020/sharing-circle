import { useEffect, useState } from "react";
import { api } from "./api";
import { useLang } from "./i18n";
import { termsText } from "./termsText";
import { LangSwitch } from "./ui";

let adminCache: Promise<string | null> | null = null;
/** Контакт администратора берётся из настроек сервиса (wrangler.toml → ADMIN_CONTACT). */
function useAdminContact(): string | null {
  const [admin, setAdmin] = useState<string | null>(null);
  useEffect(() => {
    adminCache ??= fetch("/api/info")
      .then((r) => r.json())
      .then((j: { adminContact?: string | null }) => j.adminContact?.replace(/^@/, "") || null)
      .catch(() => null);
    adminCache.then(setAdmin);
  }, []);
  return admin;
}

/** Текст правил. Используется на экране согласия, на отдельной странице и на лендинге. */
export function TermsContent({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const lang = useLang();
  const t = termsText(lang);
  const admin = useAdminContact();
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="terms">
      <H>{t.rulesTitle}</H>
      <ul>
        {t.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <H>{t.responsibilityTitle}</H>
      {t.responsibility.map((p) => (
        <p key={p}>{p}</p>
      ))}

      <H>{t.privacyTitle}</H>
      <dl>
        {t.privacy.map((p) => (
          <div key={p.term}>
            <dt>{p.term}</dt>
            <dd>{p.text}</dd>
          </div>
        ))}
      </dl>
      <p>
        {admin ? (
          <>
            {t.contact.before} <a href={`https://t.me/${admin}`}>@{admin}</a> {t.contact.after}
          </>
        ) : (
          t.contact.none
        )}
      </p>
      <p className="hint">{t.updated}</p>
    </div>
  );
}

/** Отдельная страница с правилами (ссылка со вкладки «Моё»). */
export function TermsPage() {
  const t = termsText(useLang());
  return (
    <>
      <h1>{t.title}</h1>
      <TermsContent />
    </>
  );
}

/** Экран при первом открытии: без согласия с правилами пользоваться каталогом нельзя. */
export function TermsGate({ onAccepted }: { onAccepted: () => void }) {
  const t = termsText(useLang());
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.acceptTerms();
      onAccepted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="terms-gate">
      <div className="row">
        <h1>{t.title}</h1>
        <LangSwitch />
      </div>
      <p className="lead">{t.intro}</p>
      <TermsContent />
      <div className="terms-accept">
        <label className="check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          {t.agree}
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary wide" disabled={!checked || busy} onClick={accept}>
          {t.continue}
        </button>
      </div>
    </div>
  );
}
