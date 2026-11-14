async function authorize(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "").trim();
  if (!token) return { response: Response.json({ error: "not_authenticated" }, { status: 401 }) };
  let identity;
  try {
    const response = await fetch("https://accounts.theegget.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cf: { cacheTtl: 0 }
    });
    if (!response.ok) return { response: Response.json({ error: "not_authenticated" }, { status: 401 }) };
    identity = await response.json();
  } catch {
    return { response: Response.json({ error: "tc_accounts_unavailable" }, { status: 503 }) };
  }
  const id = Number(identity.sub);
  if (!Number.isSafeInteger(id) || id < 1) return { response: Response.json({ error: "invalid_identity" }, { status: 401 }) };
  const account = await env.TC.prepare("SELECT id, role, status FROM users WHERE id = ?").bind(id).first();
  if (!account || account.status !== "active" || Number(account.role) < 2) {
    return { response: Response.json({ error: "staff_only", message: "TC Support role or higher is required." }, { status: 403 }) };
  }
  return { account };
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (url.searchParams.get("proof") === "1") {
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "invalid_request" }, { status: 400 });
    const row = await env.TC.prepare("SELECT file_name, mime_type, proof_data FROM social_verification_requests WHERE id = ?").bind(id).first();
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    let bytes;
    try { bytes = Uint8Array.from(atob(row.proof_data), character => character.charCodeAt(0)); }
    catch { return Response.json({ error: "proof_unavailable" }, { status: 500 }); }
    const filename = String(row.file_name || "proof").replaceAll("\\r", "_").replaceAll("\\n", "_").replaceAll('"', "_");
    return new Response(bytes, { headers: {
      "Content-Type": row.mime_type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    } });
  }
  const result = await env.TC.prepare("SELECT r.id, r.user_id, r.verification_type, r.explanation, r.file_name, r.mime_type, r.status, r.created_at, u.username FROM social_verification_requests r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' ORDER BY r.created_at ASC LIMIT 100").all();
  return Response.json({ requests: result.results || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function onRequestPatch({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  if (Number(auth.account.role) < 3) return Response.json({ error: "admin_only", message: "Admin role or higher is required to approve or reject verification." }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const id = Number(body?.id);
  const status = body?.status;
  if (!Number.isSafeInteger(id) || id < 1 || !["approved", "rejected"].includes(status)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const item = await env.TC.prepare("SELECT user_id, verification_type, status FROM social_verification_requests WHERE id = ?").bind(id).first();
  if (!item || item.status !== "pending") return Response.json({ error: "request_not_pending" }, { status: 404 });
  const now = new Date().toISOString();
  if (status === "approved") {
    await env.TC.prepare("UPDATE users SET verified = 1, verification_type = ? WHERE id = ?").bind(item.verification_type, item.user_id).run();
  }
  await env.TC.prepare("UPDATE social_verification_requests SET status = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'").bind(status, now, id).run();
  return Response.json({ success: true, id, status }, { headers: { "Cache-Control": "no-store" } });
}
