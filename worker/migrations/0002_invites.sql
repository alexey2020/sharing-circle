-- Круги создаются только по приглашению владельца сервиса.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN can_create INTEGER NOT NULL DEFAULT 0;
ALTER TABLE circles ADD COLUMN created_by INTEGER;

CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  created_by INTEGER NOT NULL,
  used_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT
);
