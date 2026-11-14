export async function onRequestGet({ env }) {
  try {
    const result = await env.TC.prepare("SELECT id, name, url, category, description, icon, sort_order FROM official_apps ORDER BY sort_order ASC, id ASC").all();
    return Response.json({ apps: result.results || [] }, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch {
    return Response.json({ error: "official_apps_unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" }
    });
  }
}
