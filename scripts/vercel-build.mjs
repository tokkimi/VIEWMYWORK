// Vercel build: generate client, apply migrations with a direct (unpooled) connection,
// bootstrap default plans/templates idempotently, then build Next.js.
import { execSync } from "node:child_process";

const pooled = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
const direct = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || pooled;
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

run("npx prisma generate");
if (direct) {
  run("npx prisma migrate deploy", { DATABASE_URL: direct });
  run("node prisma/bootstrap.mjs", { DATABASE_URL: direct });
} else {
  console.warn("\n⚠️  No DATABASE_URL configured — skipping migrations. Attach a Postgres database and redeploy.\n");
}
run("npx next build", pooled ? { DATABASE_URL: pooled } : {});
