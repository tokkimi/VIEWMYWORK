# VIEWMYWORK

A black-and-white, glassy client portal for sending work without exposing a creator's entire file system.

## Run locally

1. Copy `.env.example` to `.env.local` and fill in the services you want to use.
2. Run `npm install` then `npm run dev`.
3. Run `db/schema.sql` once against a Neon Postgres database.

## Integration model

- **Google Drive:** each creator authorizes Drive through OAuth. OAuth refresh tokens are AES-256-GCM encrypted before persistence. Only folder IDs deliberately saved to `shared_folders` are rendered inside a client space; the application never grants Drive sharing permissions to a client.
- **Resend:** server-only invitation email route. API keys are never shipped to the browser.
- **Neon:** owns spaces, encrypted integration tokens, selected folder references, and expiring invitation records.
- **File storage:** Google Drive is the first source. Add an S3-compatible storage adapter later behind the same `shared_folders` capability, rather than coupling views to a storage vendor.

## Required production work

The OAuth code exchange, token encryption, database persistence, folder-selection API and invitation persistence are in place. Before launch, replace `lib/auth.js` with your session provider and build the authenticated client-space viewer that consumes the selected folder IDs.
