import { NextResponse, type NextRequest } from "next/server";
import { consumeVerification } from "@/server/actions/auth";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const next = req.nextUrl.searchParams.get("next");
  const ok = token ? await consumeVerification(token) : false;
  const dest = ok ? (next && next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding") : "/verify-email?invalid=1";
  return NextResponse.redirect(new URL(dest, env.appUrl));
}
