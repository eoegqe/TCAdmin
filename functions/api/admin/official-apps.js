const ROLE_LEVEL = { banned: 0, user: 1, support: 2, admin: 3, co_owner: 4, owner: 5 };

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

function validUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function normalize(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const sortOrder = Number.isInteger(Number(body?.sort_order)) ? Number(body.sort_order) : 0;
  if (name.length < 2 || name.length > 70) return { error: "App name must be between 2 and 70 characters." };
  if (!validUrl(url) || url.length > 2048) return { error: "Enter a valid HTTP or HTTPS app URL." };
  if (category.length > 50 || description.length > 240 || icon.length > 8) return { error: "Category, description, or icon text is too long." };
  return { name, url, category, description, icon, sort_order: sortOrder };
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  try {
    const result = await env.TC.prepare("SELECT id, name, url, category, description, icon, sort_order, created_at, updated_at FROM official_apps ORDER BY sort_order ASC, id ASC").all();
    return json({ apps: result.results || [] });
  } catch {
    return json({ error: "official_apps_unavailable", message: "Could not load official apps. Apply the official apps database migration first." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const app = normalize(body);
  if (app.error) return json({ error: "invalid_app", message: app.error }, 400);
  const now = new Date().toISOString();
  try {
    if (body.id !== undefined && body.id !== null) {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id < 1) return json({ error: "invalid_id" }, 400);
      const result = await env.TC.prepare("UPDATE official_apps SET name = ?, url = ?, category = ?, description = ?, icon = ?, sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(app.name, app.url, app.category, app.description, app.icon, app.sort_order, now, id).run();
      if (!result.meta?.changes) return json({ error: "app_not_found" }, 404);
      return json({ success: true, id });
    }
    const result = await env.TC.prepare("INSERT INTO official_apps (name, url, category, description, icon, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(app.name, app.url, app.category, app.description, app.icon, app.sort_order, now, now).run();
    return json({ success: true, id: result.meta?.last_row_id });
  } catch {
    return json({ error: "official_app_save_failed", message: "Could not save this official app." }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return json({ error: "invalid_id" }, 400);
  try {
    const result = await env.TC.prepare("DELETE FROM official_apps WHERE id = ?").bind(id).run();
    return result.meta?.changes ? json({ success: true }) : json({ error: "app_not_found" }, 404);
  } catch {
    return json({ error: "official_app_delete_failed", message: "Could not remove this official app." }, 503);
  }
}
