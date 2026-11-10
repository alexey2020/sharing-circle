import { useEffect, useState } from "react";
import { t } from "./i18n";
import { LangSwitch } from "./ui";

export function Landing() {
  const [bot, setBot] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.json())
      .then((j: { botUsername?: string }) => setBot(j.botUsername ?? null))
      .catch(() => {});
  }, []);
  const l = t.landing;
  const cta = bot && (
    <a className="btn primary landing-cta" href={`https://t.me/${bot}`}>
      {l.cta}
    </a>
  );

  return (
    <div className="landing">
      <div className="landing-top">
        <span className="landing-name">{t.appName}</span>
        <LangSwitch />
      </div>

      <header className="landing-hero">
        <h1>{l.headline}</h1>
        <p className="landing-lead">{l.lead}</p>
        {cta}
      </header>

      <section>
        <h2>{l.howTitle}</h2>
        <ol className="landing-steps">
          {l.steps.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>{l.kindsTitle}</h2>
        <div className="landing-grid">
          {l.kinds.map((k) => (
            <div key={k.title} className="landing-card">
              <span className="landing-emoji" aria-hidden>
                {k.emoji}
              </span>
              <h3>{k.title}</h3>
              <p>{k.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>{l.featuresTitle}</h2>
        <div className="landing-grid">
          {l.features.map((f) => (
            <div key={f.title} className="landing-card">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>{l.startTitle}</h2>
        <p>
          <strong>{l.startHave}</strong> {l.startHaveText} <code>/catalog</code>.
        </p>
        <p>
          <strong>{l.startNew}</strong> {l.startNewText}
        </p>
      </section>

      <section>
        <h2>{l.dataTitle}</h2>
        <p>{l.dataText}</p>
      </section>

      <footer className="landing-footer">{cta}</footer>
    </div>
  );
}
