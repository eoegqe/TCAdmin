# TC Admin

The administration and support dashboard concept for `admin.theegget.com`.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm install
npm run dev
```

To verify a production build:

```bash
npm run build
npm run preview
```

## Cloudflare D1 connection

The repository includes a Wrangler Pages configuration that binds the existing Cloudflare D1 database named `tc` to the `TC` binding. The binding uses database ID `fd0e9d90-b443-4002-8378-f0d817fb415b`.

The Pages Function at `/api/health` performs a harmless `SELECT 1` query to confirm that the binding works. Once deployed to Cloudflare Pages, check `https://admin.theegget.com/api/health` to verify the connection.

The health endpoint only confirms database connectivity. It does not expose account records.

## Current status

The D1 binding and health endpoint are configured, but the dashboard is still a **frontend prototype using sample data**. Account records and support actions are not yet wired to the database.

Before production use, implement and test:

- TC Accounts authentication and secure staff-session handling.
- Server-side role and permission checks for owner, administrator, and support staff.
- Authenticated backend APIs for account lookup, support requests, sub-account records, and service policy enforcement.
- Verified external-account ownership before support creates links or changes identity information.
- Audit logging for all sensitive actions, including actor, target, reason, time, outcome, and override request.
- A secure Eggser integration that enforces service-specific administrator eligibility rules.
- Rate limiting, CSRF protection where applicable, input validation, session expiry, and security testing.

## Sub-account rules represented in the prototype

- A sub-account links an external service identity to a TC account; it is not necessarily a separate TC login.
- Users may manage ordinary settings and unlink existing sub-accounts.
- Users cannot arbitrarily create sub-accounts. Creation must come from an explicitly authorized service integration or TC Support after ownership verification.
- Identity information changes go through TC Support and require ownership verification. Impersonation requests must be declined.
- Service-specific policy belongs to the service that enforces it.

## Eggser rules represented in the prototype

- A qualifying security-related sub-account type change removes existing Eggser administrator permissions for 14 days.
- An override for anyone other than the owner requires a submitted request and support review; the owner may override without a request.
- A shared account is not eligible for administrator privileges unless it becomes personal or every person using it already has administrator privileges.
- Account holders remain responsible for in-game actions performed through their account.
- An override is not an automatic grant of administrator access; normal eligibility rules still apply.

## Important

The D1 binding does not make the dashboard safe for live administration by itself. Do not deploy it as a live administration tool until server-side authentication, authorization, data APIs, audit logging, and service integrations are implemented and reviewed.
