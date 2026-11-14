CREATE TABLE IF NOT EXISTS official_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_official_apps_sort ON official_apps(sort_order ASC, id ASC);

INSERT INTO official_apps (name, url, category, description, icon, sort_order, created_at, updated_at)
SELECT 'EggSys', 'https://eggsys.theegget.com', 'OPERATING SYSTEM', 'A web-based experience for the EggetSystem project.', 'ES', 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM official_apps WHERE name = 'EggSys');

INSERT INTO official_apps (name, url, category, description, icon, sort_order, created_at, updated_at)
SELECT 'Theegget''s Social', 'https://social.theegget.com', 'SOCIAL PLATFORM', 'Connect with people and pages across Theegget Creations.', 'T', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM official_apps WHERE name = 'Theegget''s Social');
