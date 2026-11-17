async function authorizeOwner(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { response: Response.json({ error: "not_authenticated" }, { status: 401 }) };

  let identity;
  try {
    const response = await fetch("https://accounts.theegget.com/oauth/userinfo", {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cf: { cacheTtl: 0 }
    });
    if (!response.ok) return { response: Response.json({ error: "not_authenticated" }, { status: 401 }) };
    identity = await response.json();
  } catch {
    return { response: Response.json({ error: "tc_accounts_unavailable" }, { status: 503 }) };
  }

  const userId = Number(identity?.sub);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return { response: Response.json({ error: "not_authenticated" }, { status: 401 }) };
  }

  try {
    const user = await env.TC.prepare("SELECT id, role, status FROM users WHERE id = ?").bind(userId).first();
    if (!user || user.status !== "active" || Number(user.role) !== 5) {
      return { response: Response.json({ error: "owner_only" }, { status: 403 }) };
    }
  } catch {
    return { response: Response.json({ error: "database_unavailable" }, { status: 503 }) };
  }

  return {};
}

async function readMaintenance(env) {
  const row = await env.TC.prepare("SELECT maintenance FROM server_settings WHERE id = 1").first();
  return Number(row?.maintenance) === 1 ? 1 : 0;
}

export async function onRequestGet({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.response) return auth.response;

  try {
    const maintenance = await readMaintenance(env);
    return Response.json(
      { maintenance, enabled: maintenance === 1 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "database_unavailable", message: "Could not load the server maintenance setting." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (![0, 1, false, true].includes(body?.maintenance)) {
    return Response.json({ error: "invalid_value", message: "Maintenance must be 0 or 1." }, { status: 400 });
  }

  const maintenance = body.maintenance === 1 || body.maintenance === true ? 1 : 0;
  try {
    const result = await env.TC.prepare("UPDATE server_settings SET maintenance = ? WHERE id = 1").bind(maintenance).run();
    if (result.meta?.changes === 0) {
      return Response.json(
        { error: "setting_missing", message: "The server_settings row (id 1) does not exist." },
        { status: 503 }
      );
    }
    return Response.json(
      { success: true, maintenance, enabled: maintenance === 1 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "database_unavailable", message: "Could not save the server maintenance setting." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
