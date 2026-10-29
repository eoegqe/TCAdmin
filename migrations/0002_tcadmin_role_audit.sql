CREATE TABLE IF NOT EXISTS tcadmin_role_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NOT NULL,
  target_user_id INTEGER NOT NULL,
  previous_role INTEGER NOT NULL CHECK (previous_role BETWEEN 0 AND 5),
  new_role INTEGER NOT NULL CHECK (new_role BETWEEN 0 AND 5),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tcadmin_role_audit_created_at ON tcadmin_role_audit(created_at DESC);
