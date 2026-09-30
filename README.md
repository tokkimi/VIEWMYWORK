# FollowMyFuture

**Your clients shouldn't have to ask "Where are we?"**

A multi-tenant SaaS for professionals: specifications, progress, deliverables, approvals, files, invoices and online payments — in one client portal.

`Specification → Execution → Progress → Documents → Deliverables → Approval → Invoice → Payment`

## Stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS v4
- PostgreSQL + Prisma 6
- Stripe (platform subscriptions) + Stripe Connect (client invoice payments)
- S3-compatible object storage (AWS S3, Cloudflare R2…) with signed URLs
- Resend (transactional email), Google Drive API (optional)
- Vitest integration tests against a real Postgres

## Architecture

| Concern | Where |
| --- | --- |
| Tenant isolation | `src/lib/auth/context.ts` — the workspace is resolved from the session and membership is re-checked in the database on every request; the workspace cookie is only a hint. Every query is scoped by `workspaceId` and `projectScope()`. Cross-tenant ids return **404**, not 403. |
| Permissions | `src/lib/auth/permissions.ts` — role defaults + member overrides + per-project overrides (projects, tasks, files, clients, messages, invoices, finance, team, settings). Enforced server-side in every action. |
| Client visibility | `src/lib/auth/portal.ts`, `src/server/queries/portal.ts` — portal queries filter `CLIENT_VISIBLE` in SQL. Internal content never leaves the server. |
| Progress engine | `src/lib/progress.ts` — Σ(phase progress × phase weight), task weights and subtasks, `AUTO`/`MANUAL` modes. |
| Events | `src/lib/events.ts` — one registry drives the activity log, in-app notifications and email, with per-topic user preferences. |
| Invoices (Domain B) | `src/server/actions/invoices.ts`, `src/lib/invoices/*` — integer-cent maths, totals always recomputed server-side, transactional numbering (`InvoiceCounter` UPSERT + unique constraint), frozen seller/client snapshots, row-locked payment ledger, PDF rendered on demand. |
| Client payments | `src/server/services/payments.ts` — Stripe Connect direct charges on the professional's own account. Amount and currency come from the DB. Webhooks are signature-verified, idempotent (`WebhookEvent` + unique `providerPaymentId`) and cross-checked against the owning connected account. Invoices are **never** marked paid from a redirect. |
| Platform billing (Domain A) | `src/server/services/subscriptions.ts` — `Plan`, `PlanFeature`, `Subscription`, `PlatformPayment`. Separate webhook, tables and reporting. The price is snapshotted per subscription, so plan edits never change existing subscribers. |
| Plans & quotas | `src/lib/plans.ts` — prices, limits (storage, active projects, clients, collaborators) and feature flags are managed from **Platform admin → Plans**. |
| Files | `src/server/actions/files.ts` — quota check → presigned PUT → HEAD verification → counted. Reads go through `/api/files/:id` (authorisation, then a 5-minute signed URL). SVG and HTML uploads are rejected. |
| Previews | `src/server/services/previews.ts` — framability detected once (X-Frame-Options / CSP) with an SSRF-safe fetch; falls back to an og:image card instead of a broken iframe. |
| Scheduled jobs | `/api/cron/daily` (Vercel Cron) — overdue detection, deduplicated automatic reminders, deadline alerts, cleanup and Drive link health. |

## Getting started

```bash
cp .env.example .env         # fill DATABASE_URL at minimum
npm install
npx prisma migrate deploy
node prisma/bootstrap.mjs    # default plans (Starter €2, Pro €9.90, Business €24.90) + templates
npm run dev
```

Set `SUPER_ADMIN_EMAIL` to your email: signing up with it (or re-running the bootstrap) grants **Platform administration** (`/admin`), where you manage plans, prices, quotas and features.

### Optional integrations

Each integration is optional. When one isn't configured, the UI shows a clear "not configured" state instead of faking success.

- **Email** — `RESEND_API_KEY`, `EMAIL_FROM`. Without it, email attempts are logged as `NOT_CONFIGURED` and new accounts are auto-verified.
- **Stripe** — `STRIPE_SECRET_KEY`, plus two webhook endpoints:
  - `/api/webhooks/stripe/platform` (events on your account): `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` → `STRIPE_PLATFORM_WEBHOOK_SECRET`
  - `/api/webhooks/stripe/connect` (events on connected accounts): `checkout.session.completed`, `checkout.session.async_payment_*`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`
- **Storage** — the `S3_*` variables. The bucket needs a CORS rule allowing `PUT` from your app origin.
- **Google Drive** — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, with redirect URI `${APP_URL}/api/integrations/google/callback`.

## Tests

```bash
createdb viewmywork_test     # or set TEST_DATABASE_URL (the database name must end in _test)
npm test
```

The tests cover tenant isolation (forged ids and workspace cookies), authorization (collaborator without finance access, unassigned projects, viewer), client visibility, file authorization, invitations, invoice maths and snapshots, concurrent numbering, concurrent partial payments, webhook idempotency, a spoofed connected account, the checkout amount, and approval history across versions.

## Deploying on Vercel

1. Attach a Postgres database (e.g. Neon from the Vercel Marketplace). `DATABASE_URL` / `POSTGRES_PRISMA_URL` (pooled) and `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` (migrations) are detected automatically.
2. Set `APP_URL`, `ENCRYPTION_KEY`, `CRON_SECRET` and `SUPER_ADMIN_EMAIL`, plus any optional integrations.
3. The build (`scripts/vercel-build.mjs`) applies migrations and bootstraps plans and templates idempotently.
4. `vercel.json` schedules the daily cron job.
