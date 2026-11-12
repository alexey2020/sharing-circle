-- Наблюдение за доменами: последнее известное состояние, чтобы писать админу только при изменениях.
CREATE TABLE domain_watch (
  domain TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
