import { connect } from "cloudflare:sockets";

const ROLE_LEVEL = { banned: 0, user: 1, support: 2, admin: 3, co_owner: 4, owner: 5 };
const FROM_ADDRESS = "notify@theegget.com";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

function base64Raw(value) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Text(value) {
  return base64Raw(value).replace(/.{1,76}/g, "$&\r\n").trim();
}

function smtpAddress(value) {
  return value.replace(/[\r\n<>]/g, "");
}

async function sendMailWithIonos(env, { recipients, subject, message }) {
  if (!env.IONOS_SMTP_USER || !env.IONOS_SMTP_PASSWORD) {
    throw new Error("IONOS SMTP secrets are missing from the TCAdmin Worker");
  }

  const host = env.IONOS_SMTP_HOST || "smtp.ionos.com";
  const port = Number(env.IONOS_SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid IONOS SMTP port");

  const socket = connect({ hostname: host, port }, { secureTransport: "on", allowHalfOpen: false });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  let pending = "";
  let lines = [];

  const readReply = async () => {
    while (true) {
      const end = lines.findIndex(line => /^\d{3} /.test(line));
      if (end >= 0) {
        const reply = lines.splice(0, end + 1).join("\n");
        return reply;
      }
      const part = await reader.read();
      if (part.done) throw new Error("SMTP connection closed unexpectedly");
      pending += decoder.decode(part.value, { stream: true });
      const split = pending.split("\r\n");
      pending = split.pop();
      lines.push(...split);
    }
  };

  const command = async (line, expected) => {
    await writer.write(encoder.encode(line + "\r\n"));
    const reply = await readReply();
    if (!expected.includes(Number(reply.slice(0, 3)))) {
      throw new Error(`SMTP command failed (${reply.slice(0, 3)}): ${reply.split("\n").at(-1)?.slice(4) || "unknown response"}`);
    }
    return reply;
  };

  try {
    const greeting = await readReply();
    if (!greeting.startsWith("220")) throw new Error("SMTP server greeting failed");
    await command("EHLO admin.theegget.com", [250]);
    await command("AUTH LOGIN", [334]);
    await command(base64Raw(env.IONOS_SMTP_USER), [334]);
    await command(base64Raw(env.IONOS_SMTP_PASSWORD), [235]);
    await command(`MAIL FROM:<${FROM_ADDRESS}>`, [250]);
    for (const recipient of recipients) await command(`RCPT TO:<${smtpAddress(recipient)}>`, [250, 251]);
    await command("DATA", [354]);

    const boundary = `tcadmin-${crypto.randomUUID()}`;
    const plain = message.replace(/\r\n|\r/g, "\n").replace(/\n/g, "\r\n");
    const html = escapeHtml(message).replace(/\r\n|\r|\n/g, "<br>");
    const encodedSubject = `=?UTF-8?B?${base64Raw(subject)}?=`;
    const mime = [
      `From: Theegget Creations <${FROM_ADDRESS}>`,
      recipients.length === 1 ? `To: <${smtpAddress(recipients[0])}>` : "To: undisclosed-recipients:;",
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@theegget.com>`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Text(plain),
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Text(`<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#202124"><div>${html}</div></body></html>`),
      `--${boundary}--`,
      ""
    ].join("\r\n").replace(/(^|\r\n)\./g, "$1..");

    await writer.write(encoder.encode(mime + ".\r\n"));
    const accepted = await readReply();
    if (!accepted.startsWith("250")) throw new Error("SMTP server did not accept the message");
    try { await command("QUIT", [221]); } catch {}
  } finally {
    try { await writer.close(); } catch {}
    try { await reader.cancel(); } catch {}
    try { socket.close(); } catch {}
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const announcement = body?.announcement === true;
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!subject || subject.length > 180 || /[\\r\\n]/.test(subject)) {
    return json({ error: "invalid_subject", message: "Subject must be between 1 and 180 characters." }, 400);
  }
  if (!message || message.length > 20000) {
    return json({ error: "invalid_message", message: "Message must be between 1 and 20,000 characters." }, 400);
  }

  let recipients;
  if (announcement) {
    try {
      const result = await env.TC.prepare("SELECT email FROM users WHERE status = 'active' AND email IS NOT NULL AND email <> ''").all();
      recipients = [...new Set((result.results || []).map(row => String(row.email).trim()).filter(email => /^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(email)))];
    } catch {
      return json({ error: "recipient_lookup_failed", message: "TC accounts could not be loaded for this announcement." }, 503);
    }
    if (!recipients.length) return json({ error: "no_recipients", message: "There are no active TC accounts with valid email addresses." }, 400);
  } else {
    if (to.length > 254 || !/^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(to)) {
      return json({ error: "invalid_recipient", message: "Enter one valid recipient email address." }, 400);
    }
    recipients = [to];
  }

  try {
    await sendMailWithIonos(env, { recipients, subject, message });
    return json({ success: true, from: FROM_ADDRESS, recipient_count: recipients.length, announcement });
  } catch (error) {
    console.error("TCAdmin SMTP email send failed:", String(error?.stack || error?.message || error));
    return json({
      error: "email_send_failed",
      message: "TCAdmin could not send this email through IONOS SMTP. Check the IONOS SMTP secrets and mailbox credentials."
    }, 502);
  }
}
