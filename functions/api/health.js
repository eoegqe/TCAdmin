export async function onRequestGet({ env }) {
  try {
    const result = await env.TC.prepare("SELECT 1 AS ok").first();

    if (result?.ok !== 1) {
      return Response.json(
        { status: "database_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json(
      { service: "TCAdmin API", database: "tc", status: "connected" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { service: "TCAdmin API", status: "database_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
