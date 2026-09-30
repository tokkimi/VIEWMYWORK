import { headers } from "next/headers";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** Fixed-window rate limiter backed by Postgres (works across serverless instances). */
export async function rateLimit(bucket: string, max: number, windowSec: number, id?: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const key = `${bucket}:${id ?? ip}`;
  const now = new Date();
  const reset = new Date(now.getTime() + windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${reset} ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  if (Number(rows[0].count) > max) throw new AppError("Too many attempts. Please wait a moment and try again.", "RATE_LIMIT");
}
