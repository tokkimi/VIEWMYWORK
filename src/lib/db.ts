import { PrismaClient } from "@prisma/client";

const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
// Serverless Postgres (Neon) can take a few seconds to wake up: allow for it instead of failing the page.
const dbUrl = rawUrl && !/[?&]connect_timeout=/.test(rawUrl) ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}connect_timeout=15` : rawUrl;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Accept the variable names injected by Vercel Postgres / Neon integrations.
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
