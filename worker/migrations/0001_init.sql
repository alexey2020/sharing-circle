CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  can_write INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE memberships (
  user_id INTEGER NOT NULL REFERENCES users(id),
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, circle_id)
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('thing','book','skill','help')),
  direction TEXT NOT NULL CHECK (direction IN ('offer','want')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  search TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft','available','busy','hidden')),
  announced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX items_owner ON items(owner_id);

CREATE TABLE item_circles (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  PRIMARY KEY (item_id, circle_id)
);
CREATE INDEX item_circles_circle ON item_circles(circle_id);

CREATE TABLE item_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX item_photos_item ON item_photos(item_id);

CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','declined','handed','done','cancelled')),
  message TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX requests_item ON requests(item_id);
CREATE INDEX requests_requester ON requests(requester_id);

-- Журнал всех действий: основа для будущих баллов и статистики
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  request_id INTEGER,
  actor_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
