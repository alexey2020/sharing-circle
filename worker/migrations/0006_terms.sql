-- Согласие с правилами и уведомлением о данных: какую версию текста и когда принял человек.
ALTER TABLE users ADD COLUMN terms_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
