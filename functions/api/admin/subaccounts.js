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

async function authorizeStaff(request, env) {
  let identity;
  try { identity = await getIdentity(request); } catch { return { response: Response.json({ error: "tc_accounts_unavailable" }, { status: 503 }) }; }
  if (!identity) return { response: Response.json({ error: "not_authenticated" }, { status: 401 }) };
  try {
    const actor = await env.TC.prepare("SELECT id, role, status FROM users WHERE id = ?").bind(identity.id).first();
    if (!actor || actor.status !== "active" || Number(actor.role) < 2) return { response: Response.json({ error: "staff_only", message: "Support role or higher is required." }, { status: 403 }) };
    return { actor };
  } catch { return { response: Response.json({ error: "database_unavailable" }, { status: 503 }) }; }
}

export async function onRequestGet({ request, env }) {
  const auth = await authorizeStaff(request, env);
  if (auth.response) return auth.response;
  const parentId = Number(new URL(request.url).searchParams.get("main_user_id"));
  if (!Number.isSafeInteger(parentId) || parentId < 1) return Response.json({ error: "invalid_main_account" }, { status: 400 });
  try {
    const parent = await env.TC.prepare("SELECT id FROM users WHERE id = ?").bind(parentId).first();
    if (!parent) return Response.json({ error: "account_not_found" }, { status: 404 });
    const result = await env.TC.prepare("SELECT id, username, service, created_at FROM tc_service_sub_accounts WHERE main_user_id = ? ORDER BY created_at ASC").bind(parentId).all();
    return Response.json({ subaccounts: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "subaccounts_unavailable", message: "Apply TCAccounts migration 0008 before using sub-account management." }, { status: 503 });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorizeStaff(request, env);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const action = body?.action;
  const parentId = Number(body?.main_user_id);
  if (!["create", "unlink"].includes(action) || !Number.isSafeInteger(parentId) || parentId < 1) {
    return Response.json({ error: "invalid_subaccount", message: "A valid parent account is required." }, { status: 400 });
  }

  try {
    const parent = await env.TC.prepare("SELECT id, status FROM users WHERE id = ?").bind(parentId).first();
    if (!parent) return Response.json({ error: "account_not_found" }, { status: 404 });

    if (action === "create") {
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const service = typeof body?.service === "string" ? body.service.trim() : "";
      if (username.length < 3 || username.length > 32 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
        return Response.json({ error: "invalid_username", message: "Sub username must be 3–32 letters, numbers, dots, underscores, or hyphens." }, { status: 400 });
      }
      if (!service || service.length > 64 || !/^[a-zA-Z0-9][a-zA-Z0-9 ._:-]*$/.test(service)) {
        return Response.json({ error: "invalid_service", message: "Enter a service name between 1 and 64 characters." }, { status: 400 });
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.TC.prepare("INSERT INTO tc_service_sub_accounts(id, main_user_id, username, service, created_by, created_at) VALUES(?,?,?,?,?,?)")
        .bind(id, parentId, username, service, auth.actor.id, now).run();
      await env.TC.prepare("INSERT INTO audit_logs(id, actor_user_id, action, target_type, target_id, metadata, created_at) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), auth.actor.id, "subaccount.create", "subaccount", id, JSON.stringify({ main_user_id: parentId, username, service }), now).run();
      return Response.json({ success: true, action, subaccount: { id, username, service, created_at: now } });
    }

    const subAccountId = typeof body?.sub_account_id === "string" ? body.sub_account_id.trim() : "";
    if (!subAccountId || subAccountId.length > 64) return Response.json({ error: "invalid_subaccount" }, { status: 400 });
    const existing = await env.TC.prepare("SELECT id, username, service FROM tc_service_sub_accounts WHERE id = ? AND main_user_id = ?").bind(subAccountId, parentId).first();
    if (!existing) return Response.json({ error: "subaccount_not_found" }, { status: 404 });
    await env.TC.prepare("DELETE FROM tc_service_sub_accounts WHERE id = ? AND main_user_id = ?").bind(subAccountId, parentId).run();
    const now = new Date().toISOString();
    await env.TC.prepare("INSERT INTO audit_logs(id, actor_user_id, action, target_type, target_id, metadata, created_at) VALUES(?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), auth.actor.id, "subaccount.unlink", "subaccount", subAccountId, JSON.stringify({ main_user_id: parentId, username: existing.username, service: existing.service }), now).run();
    return Response.json({ success: true, action, sub_account_id: subAccountId });
  } catch (e) {
    if (String(e?.message || "").includes("UNIQUE")) return Response.json({ error: "subaccount_exists", message: "That username is already registered for this service." }, { status: 409 });
    return Response.json({ error: "subaccounts_unavailable", message: "The sub-account could not be saved. Check that TCAccounts migration 0008 is applied." }, { status: 503 });
  }
}
