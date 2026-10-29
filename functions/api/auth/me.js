export async function onRequestGet({ request, env }) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  let identity;
  try {
    const response = await fetch("https://accounts.theegget.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cf: { cacheTtl: 0 }
    });
    if (!response.ok) return Response.json({ error: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    identity = await response.json();
  } catch {
    return Response.json({ error: "tc_accounts_unavailable", message: "Could not verify your TC Account right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const id = Number(identity.sub);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "invalid_identity" }, { status: 401 });
  try {
    const account = await env.TC.prepare("SELECT id, username, status FROM users WHERE id = ? AND status = 'active'").bind(id).first();
    if (!account) return Response.json({ error: "account_unavailable" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    let role = "none";
    if (id === 1) role = "owner";
    else {
      const row = await env.TC.prepare("SELECT role FROM tcadmin_roles WHERE user_id = ?").bind(id).first();
      if (row && ["admin", "support", "viewer"].includes(row.role)) role = row.role;
    }
    return Response.json({ user: { id: account.id, username: account.username, role } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "TCAdmin access storage is not ready. Apply migrations/0001_tcadmin_roles.sql." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
