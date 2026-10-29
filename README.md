# TC Admin

TC Admin is the administration dashboard for `admin.theegget.com`.

## Development

Requirements: Node.js 18 or newer.

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Build and preview the production bundle:

```bash
npm run build
npm run preview
```

## Cloudflare Pages deployment

This repository uses Vite and is configured for Cloudflare Pages. The production build output directory is `dist`.

Recommended build settings:

- Build command: `bun run build`
- Build output directory: `dist`
- Deploy command, if using a custom Wrangler deploy command: `npx wrangler pages deploy dist --project-name=tcadmin`

Do not use `npx wrangler deploy` for this Pages project; that command targets Worker scripts rather than deploying the Pages output directory.

The repository's `wrangler.toml` configures the Pages output directory and the `TC` binding for the existing D1 database. Confirm that the Pages project and binding are configured correctly in Cloudflare before relying on a deployment.

## Security and production readiness

A D1 binding alone does not make an administration dashboard production-ready. Before using TC Admin for live account administration, verify that:

- Authentication is implemented and validated server-side.
- Every administrative API enforces role-based permissions server-side.
- Sensitive actions are audited with the actor, target, timestamp, reason, and result.
- Account and service data is retrieved through authenticated backend APIs rather than sample data.
- Inputs are validated and requests are rate-limited; session expiry and CSRF protections are handled where applicable.
- Service integrations verify account ownership and enforce their own authorization rules.

Test authentication, authorization, error handling, and deployment configuration before using this dashboard to make live changes.