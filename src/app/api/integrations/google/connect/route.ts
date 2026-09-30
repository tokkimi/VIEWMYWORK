import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getWorkspaceCtx, can } from "@/lib/auth/context";
import { integrations, env } from "@/lib/env";
import { hasFeature } from "@/lib/plans";
import { randomToken, hmac } from "@/lib/crypto";
import { DRIVE_SCOPES, redirectUri } from "@/server/services/google-drive";

export async function GET() {
  const ctx = await getWorkspaceCtx();
  if (!ctx || !can(ctx, "settings", "manage")) return NextResponse.redirect(new URL("/app", env.appUrl));
  if (!integrations.googleDrive()) return NextResponse.redirect(new URL("/app/settings/integrations?error=not_configured", env.appUrl));
  if (!(await hasFeature(ctx.workspace.id, "google_drive"))) return NextResponse.redirect(new URL("/app/settings/integrations?error=plan", env.appUrl));
  const nonce = randomToken(16);
  const state = `${ctx.workspace.id}.${nonce}.${hmac(`${ctx.workspace.id}.${ctx.user.id}.${nonce}`)}`;
  (await cookies()).set("vmw_gstate", state, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/api/integrations/google", maxAge: 600 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: env.google.clientId, redirect_uri: redirectUri(), response_type: "code", scope: DRIVE_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state }).toString();
  return NextResponse.redirect(url);
}
