import { onRequestGet as health } from "../functions/api/health.js";
import { onRequestPost as exchangeToken } from "../functions/api/auth/token.js";
import { onRequestGet as currentUser } from "../functions/api/auth/me.js";
import { onRequestGet as listRoles, onRequestPost as updateRole } from "../functions/api/admin/roles.js";
import { onRequestGet as listOAuthClients, onRequestPost as updateOAuthClient, onRequestDelete as deleteOAuthClient } from "../functions/api/admin/oauth-clients.js";
import { onRequestPost as sendAdminMail } from "../functions/api/admin/send-mail.js";

const routes = new Map([
  ["GET /api/health", health],
  ["POST /api/auth/token", exchangeToken],
  ["GET /api/auth/me", currentUser],
  ["GET /api/admin/roles", listRoles],
  ["POST /api/admin/roles", updateRole],
  ["GET /api/admin/oauth-clients", listOAuthClients],
  ["POST /api/admin/oauth-clients", updateOAuthClient],
  ["DELETE /api/admin/oauth-clients", deleteOAuthClient],
  ["POST /api/admin/send-mail", sendAdminMail]
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handler = routes.get(`${request.method.toUpperCase()} ${url.pathname}`);

    if (handler) {
      try {
        return await handler({ request, env, ctx });
      } catch (error) {
        console.error("TC Admin API request failed:", error);
        return Response.json(
          { error: "internal_error", message: "The request could not be completed." },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
