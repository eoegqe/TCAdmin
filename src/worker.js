import { onRequestGet as health } from "../functions/api/health.js";
import { onRequestPost as exchangeToken } from "../functions/api/auth/token.js";
import { onRequestGet as currentUser } from "../functions/api/auth/me.js";
import { onRequestGet as listRoles, onRequestPost as updateRole } from "../functions/api/admin/roles.js";

const routes = new Map([
  ["GET /api/health", health],
  ["POST /api/auth/token", exchangeToken],
  ["GET /api/auth/me", currentUser],
  ["GET /api/admin/roles", listRoles],
  ["POST /api/admin/roles", updateRole]
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
