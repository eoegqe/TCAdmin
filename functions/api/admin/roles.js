const ROLE_TO_NUMBER = { banned: 0, user: 1, support: 2, admin: 3, co_owner: 4 };
const NUMBER_TO_ROLE = { 0: "banned", 1: "user", 2: "support", 3: "admin", 4: "co_owner", 5: "owner" };

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
  return Number.isSafeInteger(id) && id > 0 ? { id } : null;
}

async function authorizeOwner(request, env) {
  let identity;
  try { identity = await getIdentity(request); } catch { return { response: Response.json({ error: "tc_accounts_unavailable" }, { status: 503 }) }; }
  if (!identity) return { response: Response.json({ error: "not_authenticated" }, { status: 401 }) };
  if (identity.id !== 1) return { response: Response.json({ error: "owner_only", message: "Only TC account ID 1 can manage TCAdmin roles." }, { status: 403 }) };
  try {
    const owner = await env.TC.prepare("SELECT id, role, status FROM users WHERE id = 1").first();
    if (!owner || owner.status !== "active" || Number(owner.role) !== 5) return { response: Response.json({ error: "owner_account_unavailable" }, { status: 403 }) };
  } catch { return { response: Response.json({ error: "database_unavailable" }, { status: 503 }) }; }
  return { identity };
}

export async function onRequestGet({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.response) return auth.response;
  try {
    const result = await env.TC.prepare("SELECT id, username, status, role FROM users ORDER BY id ASC").all();
    return Response.json({ accounts: (result.results || []).map(row => ({
      id: row.id,
      username: row.username,
      status: row.status,
      role: NUMBER_TO_ROLE[Number(row.role ?? 1)] || "user"
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "Could not load TC Accounts roles." }, { status: 503 });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const userId = Number(body?.user_id);
  const role = body?.role;
  if (!Number.isSafeInteger(userId) || userId <= 1) return Response.json({ error: "invalid_user", message: "The owner account cannot be modified." }, { status: 400 });
  if (!Object.hasOwn(ROLE_TO_NUMBER, role)) return Response.json({ error: "invalid_role" }, { status: 400 });
  try {
    const target = await env.TC.prepare("SELECT id, role FROM users WHERE id = ?").bind(userId).first();
    if (!target) return Response.json({ error: "account_not_found" }, { status: 404 });
    const nextRole = ROLE_TO_NUMBER[role];
    const now = new Date().toISOString();
    await env.TC.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ? AND id <> 1").bind(nextRole, now, userId).run();
    await env.TC.prepare("INSERT INTO tcadmin_role_audit(actor_id, target_user_id, previous_role, new_role, created_at) VALUES(1, ?, ?, ?, ?)").bind(userId, Number(target.role ?? 1), nextRole, now).run();
    return Response.json({ success: true, user_id: userId, role }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "Role storage or the TCAdmin audit migration is not ready." }, { status: 503 });
  }
}
