const ROLE_NAMES = { 0: "banned", 1: "user", 2: "support", 3: "admin", 4: "co_owner", 5: "owner" };

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
    const account = await env.TC.prepare("SELECT id, username, status, role FROM users WHERE id = ?").bind(id).first();
    if (!account || account.status !== "active") return Response.json({ error: "account_unavailable" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const role = ROLE_NAMES[Number(account.role ?? 1)];
    if (!role) return Response.json({ error: "invalid_role", message: "This account has an invalid access role." }, { status: 403 });
    return Response.json({ user: { id: account.id, username: account.username, role } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "The TC Accounts role field is not available yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
