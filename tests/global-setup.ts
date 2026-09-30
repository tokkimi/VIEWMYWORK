import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/** Rebuilds the dedicated *test* database (never the dev/prod one) and applies migrations. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/viewmywork_test";
  if (!/_test\b/.test(new URL(url).pathname)) throw new Error("Refusing to reset a database whose name doesn't end with _test");
  const db = new PrismaClient({ datasources: { db: { url } } });
  await db.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await db.$executeRawUnsafe("CREATE SCHEMA public");
  await db.$disconnect();
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
