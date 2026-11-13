export async function onRequestPost({ request, env }) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "").trim();
  if (!token) return Response.json({ error: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let identity;
  try {
    const response = await fetch("https://accounts.theegget.com/oauth/userinfo", { headers: { Authorization: "Bearer " + token, Accept: "application/json" }, cf: { cacheTtl: 0 } });
    if (!response.ok) return Response.json({ error: "not_authenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    identity = await response.json();
  } catch { return Response.json({ error: "tc_accounts_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const id = Number(identity.sub);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "invalid_identity" }, { status: 401 });
  try {
    const account = await env.TC.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").bind(id).first();
    if (!account) return Response.json({ error: "account_unavailable" }, { status: 403 });
    await env.TC.prepare("UPDATE users SET last_heartbeat_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "database_unavailable" }, { status: 503 }); }
}
