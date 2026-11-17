const SERVICES = [
  { service_id: "homepage", name: "TC Homepage", host: "theegget.com" },
  { service_id: "creations", name: "Creations", host: "creations.theegget.com" },
  { service_id: "accounts", name: "TC Accounts", host: "accounts.theegget.com" },
  { service_id: "social", name: "Theegget's Social", host: "social.theegget.com" },
  { service_id: "sites", name: "TC Sites", host: "sites.theegget.com" },
  { service_id: "dev", name: "TC Dev", host: "dev.theegget.com" },
  { service_id: "eggsys", name: "EggSys", host: "eggsys.theegget.com" },
  { service_id: "tc-api", name: "API for TC", host: "tc-api.theegget.com" },
  { service_id: "es-api", name: "API for EggetSystem", host: "es-api.theegget.com" }
];

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

async function getServices(env) {
  const rows = await env.TC.prepare("SELECT service_id, maintenance FROM service_maintenance").all();
  const values = new Map((rows.results || []).map(row => [row.service_id, Number(row.maintenance)]));
  return SERVICES.map(service => ({ ...service, maintenance: values.get(service.service_id) === 1 ? 1 : 0 }));
}

export async function onRequestGet({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.response) return auth.response;
  try {
    return Response.json({ services: await getServices(env) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "Could not load service maintenance settings." }, { status: 503 });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorizeOwner(request, env);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const serviceId = String(body?.service_id || "");
  const maintenance = Number(body?.maintenance);
  if (!SERVICES.some(service => service.service_id === serviceId) || ![0, 1].includes(maintenance)) {
    return Response.json({ error: "invalid_setting", message: "Choose a valid service and maintenance value." }, { status: 400 });
  }
  try {
    await env.TC.prepare("INSERT INTO service_maintenance (service_id, maintenance) VALUES (?, ?) ON CONFLICT(service_id) DO UPDATE SET maintenance = excluded.maintenance").bind(serviceId, maintenance).run();
    return Response.json({ success: true, services: await getServices(env) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "database_unavailable", message: "Could not save service maintenance settings." }, { status: 503 });
  }
}
