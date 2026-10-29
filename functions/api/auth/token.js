export async function onRequestPost({ request }) {
  let form;
  try { form = new URLSearchParams(await request.text()); }
  catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }

  const required = ["grant_type", "code", "client_id", "redirect_uri", "code_verifier"];
  if (required.some(key => !form.get(key))) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await fetch("https://accounts.theegget.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form.toString()
    });
    const data = await response.json().catch(() => ({ error: "invalid_token_response" }));
    return Response.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "tc_accounts_unavailable", error_description: "Could not contact TC Accounts." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
