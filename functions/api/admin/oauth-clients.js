const ROLE_LEVEL = { banned: 0, user: 1, support: 2, admin: 3, co_owner: 4, owner: 5 };
const TCADMIN_CLIENT_ID = "tc_B5LqoZygi4pJcaM_y7YF_roDmGtjYUax";

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(request, env) {
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
    const account = await env.TC.prepare("SELECT id, username, status, role FROM users WHERE id = ?").bind(id).first();
    if (!account || account.status !== "active") return { response: json({ error: "account_unavailable" }, 403) };
    if (Number(account.role) < ROLE_LEVEL.admin) return { response: json({ error: "insufficient_role", message: "Admin role or higher is required." }, 403) };
    return { account };
  } catch {
    return { response: json({ error: "database_unavailable" }, 503) };
  }
}

function validRedirects(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 10) return false;
  return values.every(value => {
    if (typeof value !== "string" || value.length > 2048) return false;
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.hostname === "localhost") && !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  });
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  try {
    const result = await env.TC.prepare(
      "SELECT c.client_id, c.name, c.owner_user_id, u.username AS owner_username, c.redirect_uris_json, c.scopes_json, c.created_at FROM oauth_clients c LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(c.owner_user_id AS TEXT) ORDER BY c.created_at DESC"
    ).all();
    return json({
      clients: (result.results || []).map(row => ({
        client_id: row.client_id,
        name: row.name,
        owner_user_id: row.owner_user_id,
        owner_username: row.owner_username || "Unknown account",
        redirect_uris: JSON.parse(row.redirect_uris_json || "[]"),
        scopes: JSON.parse(row.scopes_json || '["profile"]'),
        created_at: row.created_at,
        is_tcadmin: row.client_id === TCADMIN_CLIENT_ID
      }))
    });
  } catch (error) {
    console.error("TCAdmin OAuth client list failed:", String(error?.message || error));
    return json({ error: "oauth_clients_unavailable", message: "Could not load registered OAuth clients. Confirm the TC Accounts OAuth migration is applied to the TC database." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const clientId = typeof body?.client_id === "string" ? body.client_id.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const redirects = Array.isArray(body?.redirect_uris) ? [...new Set(body.redirect_uris.map(value => typeof value === "string" ? value.trim() : value))] : [];
  const scopes = Array.isArray(body?.scopes) ? [...new Set(body.scopes)] : [];
  if (!clientId || name.length < 2 || name.length > 80) return json({ error: "invalid_client_data", message: "Provide a client ID and an application name between 2 and 80 characters." }, 400);
  if (!validRedirects(redirects)) return json({ error: "invalid_redirect_uris", message: "Provide 1–10 valid HTTPS redirect URLs (localhost is allowed for development)." }, 400);
  if (!scopes.length || scopes.some(scope => !["profile", "email"].includes(scope))) return json({ error: "invalid_scopes", message: "Only profile and email scopes are supported." }, 400);
  try {
    const existing = await env.TC.prepare("SELECT client_id FROM oauth_clients WHERE client_id = ?").bind(clientId).first();
    if (!existing) return json({ error: "client_not_found", message: "That client ID is not registered in TC Accounts." }, 404);
    await env.TC.prepare("UPDATE oauth_clients SET name = ?, redirect_uris_json = ?, scopes_json = ? WHERE client_id = ?")
      .bind(name, JSON.stringify(redirects), JSON.stringify(scopes), clientId).run();
    return json({ success: true, client_id: clientId });
  } catch (error) {
    console.error("TCAdmin OAuth client update failed:", String(error?.message || error));
    return json({ error: "oauth_client_update_failed", message: "Could not save this OAuth client." }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") || "";
  if (!clientId) return json({ error: "missing_client_id" }, 400);
  if (clientId === TCADMIN_CLIENT_ID) return json({ error: "protected_client", message: "TCAdmin's own client registration cannot be deleted here." }, 403);
  try {
    const result = await env.TC.prepare("DELETE FROM oauth_clients WHERE client_id = ?").bind(clientId).run();
    return result.meta?.changes ? json({ success: true }) : json({ error: "client_not_found" }, 404);
  } catch {
    return json({ error: "oauth_client_delete_failed", message: "Could not delete this OAuth client." }, 503);
  }
}
