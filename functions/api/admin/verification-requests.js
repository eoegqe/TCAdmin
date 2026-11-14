const ROLE_LEVEL = { banned: 0, user: 1, support: 2, admin: 3, co_owner: 4, owner: 5 };

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(request, env, minimumRole = ROLE_LEVEL.support) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { response: json({ error: "not_authenticated" }, 401) };
  let identity;
  try {
    const response = await fetch("https://accounts.theegget.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cf: { cacheTtl: 0 }
    });
    if (!response.ok) return { response: json({ error: "not_authenticated" }, 401) };
    identity = await response.json();
  } catch {
    return { response: json({ error: "tc_accounts_unavailable" }, 503) };
  }
  const id = Number(identity.sub);
  if (!Number.isSafeInteger(id) || id < 1) return { response: json({ error: "invalid_identity" }, 401) };
  try {
    const actor = await env.TC.prepare("SELECT id, role, status FROM users WHERE id = ?").bind(id).first();
    if (!actor || actor.status !== "active") return { response: json({ error: "account_unavailable" }, 403) };
    if (Number(actor.role) < minimumRole) return { response: json({ error: "insufficient_role", message: minimumRole >= ROLE_LEVEL.admin ? "Admin role or higher is required to review requests." : "Support role or higher is required." }, 403) };
    return { actor };
  } catch {
    return { response: json({ error: "database_unavailable" }, 503) };
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const wantsProof = url.searchParams.get("proof") === "1";
  const auth = await authorize(request, env, ROLE_LEVEL.support);
  if (auth.response) return auth.response;
  try {
    if (wantsProof) {
      const id = Number(url.searchParams.get("id"));
      if (!Number.isSafeInteger(id) || id < 1) return json({ error: "invalid_request_id" }, 400);
      const row = await env.TC.prepare("SELECT file_name, mime_type, proof_data FROM social_verification_requests WHERE id = ?").bind(id).first();
      if (!row) return json({ error: "request_not_found" }, 404);
      if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(row.mime_type)) return json({ error: "invalid_proof_type" }, 415);
      const binary = atob(row.proof_data || "");
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const filename = String(row.file_name || "verification-proof").replace(/["\\/]/g, "_");
      return new Response(bytes, { headers: {
        "Content-Type": row.mime_type,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }});
    }
    const result = await env.TC.prepare(
      "SELECT r.id, r.user_id, u.username, r.verification_type, r.explanation, r.file_name, r.mime_type, r.status, r.created_at, r.reviewed_at FROM social_verification_requests r LEFT JOIN users u ON u.id = r.user_id ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 100"
    ).all();
    return json({ requests: result.results || [] });
  } catch (error) {
    console.error("TCAdmin verification list failed:", String(error?.message || error));
    return json({ error: "verification_requests_unavailable", message: "Could not load verification requests. Confirm the TC Social verification table exists in the TC database." }, 503);
  }
}

export async function onRequestPatch({ request, env }) {
  const auth = await authorize(request, env, ROLE_LEVEL.admin);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const id = Number(body?.id);
  const status = body?.status;
  if (!Number.isSafeInteger(id) || id < 1 || !["approved", "rejected"].includes(status)) return json({ error: "invalid_review" }, 400);
  try {
    const item = await env.TC.prepare("SELECT user_id, verification_type, status FROM social_verification_requests WHERE id = ?").bind(id).first();
    if (!item) return json({ error: "request_not_found" }, 404);
    if (item.status !== "pending") return json({ error: "request_not_pending", message: "This request has already been reviewed." }, 409);
    const now = new Date().toISOString();
    if (status === "approved") {
      const result = await env.TC.prepare("UPDATE social_verification_requests SET status = 'approved', reviewed_at = ? WHERE id = ? AND status = 'pending'").bind(now, id).run();
      if (!result.meta?.changes) return json({ error: "review_conflict" }, 409);
      await env.TC.prepare("UPDATE users SET verified = 1, verification_type = ? WHERE id = ?").bind(item.verification_type, item.user_id).run();
    } else {
      const result = await env.TC.prepare("UPDATE social_verification_requests SET status = 'rejected', reviewed_at = ? WHERE id = ? AND status = 'pending'").bind(now, id).run();
      if (!result.meta?.changes) return json({ error: "review_conflict" }, 409);
    }
    return json({ success: true, id, status });
  } catch (error) {
    console.error("TCAdmin verification review failed:", String(error?.message || error));
    return json({ error: "verification_review_failed", message: "Could not save this verification decision." }, 503);
  }
}
