CREATE TABLE IF NOT EXISTS tcadmin_roles (
  user_id INTEGER PRIMARY KEY NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'support', 'viewer')),
  updated_by INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tcadmin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NOT NULL,
  target_user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('role_set', 'role_removed')),
  role TEXT NOT NULL CHECK (role IN ('admin', 'support', 'viewer', 'none')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tcadmin_audit_created_at ON tcadmin_audit(created_at DESC);
