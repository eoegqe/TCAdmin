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
    const parent = await env.TC.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").bind(parentId).first();
    if (!parent) return Response.json({ error: "account_not_found" }, { status: 404 });
    const result = await env.TC.prepare("SELECT u.id, u.username, u.email, u.status, s.created_at FROM tc_sub_accounts s JOIN users u ON u.id = s.sub_user_id WHERE s.main_user_id = ? ORDER BY s.created_at ASC").bind(parentId).all();
    return Response.json({ subaccounts: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "subaccounts_unavailable", message: "Apply the TC Accounts sub-account migration before using this section." }, { status: 503 });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorizeStaff(request, env);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const action = body?.action;
  const parentId = Number(body?.main_user_id);
  const childId = Number(body?.sub_user_id);
  if (!["link", "unlink"].includes(action) || !Number.isSafeInteger(parentId) || parentId < 1 || !Number.isSafeInteger(childId) || childId < 1 || childId === 1 || parentId === childId) return Response.json({ error: "invalid_subaccount", message: "Choose a valid main account and a different existing TC account." }, { status: 400 });
  if (action === "link" && body?.ownership_verified !== true) return Response.json({ error: "ownership_verification_required", message: "Confirm that ownership has been verified before linking this sub-account." }, { status: 400 });
  try {
    const [parent, child, parentIsChild, childIsParent] = await Promise.all([
      env.TC.prepare("SELECT id, status FROM users WHERE id = ?").bind(parentId).first(),
      env.TC.prepare("SELECT id, status FROM users WHERE id = ?").bind(childId).first(),
      env.TC.prepare("SELECT sub_user_id FROM tc_sub_accounts WHERE sub_user_id = ?").bind(parentId).first(),
      env.TC.prepare("SELECT main_user_id FROM tc_sub_accounts WHERE main_user_id = ?").bind(childId).first()
    ]);
    if (!parent || !child) return Response.json({ error: "account_not_found", message: "Both TC accounts must already exist." }, { status: 404 });
    if (action === "link") {
      if (parent.status !== "active" || child.status !== "active") return Response.json({ error: "inactive_account", message: "Only active TC accounts can be linked." }, { status: 400 });
      if (parentIsChild || childIsParent) return Response.json({ error: "nested_subaccounts_not_allowed", message: "A sub-account cannot own or belong to another sub-account." }, { status: 409 });
      const now = new Date().toISOString();
      await env.TC.prepare("INSERT INTO tc_sub_accounts(main_user_id, sub_user_id, created_by, created_at) VALUES(?,?,?,?)").bind(parentId, childId, auth.actor.id, now).run();
      await env.TC.prepare("INSERT INTO audit_logs(id, actor_user_id, action, target_type, target_id, metadata, created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), auth.actor.id, "subaccount.link", "user", String(childId), JSON.stringify({ main_user_id: parentId, ownership_verified: true }), now).run();
      return Response.json({ success: true, action, main_user_id: parentId, sub_user_id: childId });
    }
    const result = await env.TC.prepare("DELETE FROM tc_sub_accounts WHERE main_user_id = ? AND sub_user_id = ?").bind(parentId, childId).run();
    if (!result.meta?.changes) return Response.json({ error: "subaccount_not_found" }, { status: 404 });
    const now = new Date().toISOString();
    await env.TC.prepare("INSERT INTO audit_logs(id, actor_user_id, action, target_type, target_id, metadata, created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), auth.actor.id, "subaccount.unlink", "user", String(childId), JSON.stringify({ main_user_id: parentId }), now).run();
    return Response.json({ success: true, action, main_user_id: parentId, sub_user_id: childId });
  } catch (e) {
    if (String(e?.message || "").includes("UNIQUE")) return Response.json({ error: "already_linked", message: "That TC account is already linked to a main account." }, { status: 409 });
    return Response.json({ error: "subaccounts_unavailable", message: "The sub-account relationship could not be saved. Check that the TC Accounts migration is applied." }, { status: 503 });
  }
}
