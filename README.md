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

## Current status

This repository contains a **frontend prototype using sample data**. It is not ready to use for real account administration. No real accounts are queried or changed by this interface.

Before production use, implement and test:

- TC Accounts authentication and secure staff-session handling.
- Server-side role and permission checks for owner, administrator, and support staff.
- A backend API for account lookup, support requests, sub-account records, and service policy enforcement.
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

The visual prototype is not a security boundary. Do not deploy it as a live administration tool until server-side authentication, authorization, data storage, audit logging, and service integrations are implemented and reviewed.
