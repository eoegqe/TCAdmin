async function getIdentity(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const response = await fetch("https://accounts.theegget.com/oauth/userinfo", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cf: { cacheTtl: 0 }
  });
  if (!response.ok) return null;
  const identity = await response.json();
  const id = Number(identity.sub);
  return Number.isSafeInteger(id) && id > 0 ? { id, username: identity.preferred_username } : null;
}

async function authorizeOwner(request, env) {
  let identity;
  try { identity = await getIdentity(request); } catch { return { error: Response.json({ error: "tc_accounts_unavailable" }, { status: 503 }) }; }
  if (!identity) return { error: Response.json({ error: "not_authenticated" }, { status: 401 }) };
  if (identity.id !== 1) return { error: Response.json({ error: "owner_only", message: "Only TC account ID 1 can manage TCAdmin roles." }, { status: 403 }) };
  try {
    const owner = await env.TC.prepare("SELECT id FROM users WHERE id = 1 AND status = 'active'").first();
    if (!owner) return { error: Response.json({ error: "owner_account_unavailable" }, { status: 403 }) };
  } catch { return { error: Response.json({ error: "database_unavailable" }, { status: 503 }) }; }
  return { identity };
}

export async function onRequestGet({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.error) return auth.error;
  try {
    const result = await env.TC.prepare("SELECT u.id, u.username, u.status, r.role FROM users u LEFT JOIN tcadmin_roles r ON r.user_id = u.id ORDER BY u.id ASC").all();
    return Response.json({ accounts: (result.results || []).map(row => ({ id: row.id, username: row.username, status: row.status, role: row.id === 1 ? "owner" : (row.role || "none") })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "Apply migrations/0001_tcadmin_roles.sql before managing roles." }, { status: 503 });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const userId = Number(body?.user_id);
  const role = body?.role;
  if (!Number.isSafeInteger(userId) || userId <= 1) return Response.json({ error: "invalid_user", message: "The owner account cannot be modified." }, { status: 400 });
  if (!["admin", "support", "viewer", "none"].includes(role)) return Response.json({ error: "invalid_role" }, { status: 400 });

  try {
    const target = await env.TC.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
    if (!target) return Response.json({ error: "account_not_found" }, { status: 404 });
    const now = new Date().toISOString();
    if (role === "none") {
      await env.TC.prepare("DELETE FROM tcadmin_roles WHERE user_id = ?").bind(userId).run();
    } else {
      await env.TC.prepare("INSERT INTO tcadmin_roles(user_id, role, updated_by, updated_at) VALUES(?, ?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, updated_by = 1, updated_at = excluded.updated_at").bind(userId, role, now).run();
    }
    await env.TC.prepare("INSERT INTO tcadmin_audit(actor_id, target_user_id, action, role, created_at) VALUES(1, ?, ?, ?, ?)").bind(userId, role === "none" ? "role_removed" : "role_set", role, now).run();
    return Response.json({ success: true, user_id: userId, role }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "Apply migrations/0001_tcadmin_roles.sql before changing roles." }, { status: 503 });
  }
}
