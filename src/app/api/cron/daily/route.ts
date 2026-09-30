import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runDailyJobs } from "@/server/services/daily";

export const maxDuration = 300;

// Invoked by Vercel Cron (Authorization: Bearer $CRON_SECRET).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await runDailyJobs();
  return NextResponse.json({ ok: true, report });
}
