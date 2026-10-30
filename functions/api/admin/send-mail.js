const ROLE_LEVEL = { banned: 0, user: 1, support: 2, admin: 3, co_owner: 4, owner: 5 };
const FROM_ADDRESS = "notify@theegget.com";

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
    if (Number(account.role) < ROLE_LEVEL.support) return { response: json({ error: "insufficient_role", message: "Support role or higher is required to send mail." }, 403) };
    return { account };
  } catch {
    return { response: json({ error: "database_unavailable" }, 503) };
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (to.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return json({ error: "invalid_recipient", message: "Enter one valid recipient email address." }, 400);
  if (!subject || subject.length > 180 || /[\r\n]/.test(subject)) return json({ error: "invalid_subject", message: "Subject must be between 1 and 180 characters." }, 400);
  if (!message || message.length > 20000) return json({ error: "invalid_message", message: "Message must be between 1 and 20,000 characters." }, 400);
  if (!env.EMAIL) return json({ error: "email_service_unavailable", message: "The email sending binding is not configured." }, 503);

  const html = escapeHtml(message).replace(/\r\n|\r|\n/g, "<br>");
  try {
    const result = await env.EMAIL.send({
      from: FROM_ADDRESS,
      to,
      subject,
      text: message,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#202124"><div style="white-space:normal">${html}</div></body></html>`
    });
    return json({ success: true, from: FROM_ADDRESS, message_id: result?.messageId || null });
  } catch (error) {
    console.error("TCAdmin email send failed:", String(error?.message || error));
    return json({ error: "email_send_failed", message: "Cloudflare could not send this email. Check Email Sending domain setup and binding configuration." }, 502);
  }
}
