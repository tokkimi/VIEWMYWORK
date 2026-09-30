import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getWorkspaceCtx, can } from "@/lib/auth/context";
import { env } from "@/lib/env";
import { encrypt, hmac, safeEqual } from "@/lib/crypto";
import { exchangeCode } from "@/server/services/google-drive";

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/app/settings/integrations?${q}`, env.appUrl));
  const ctx = await getWorkspaceCtx();
  if (!ctx || !can(ctx, "settings", "manage")) return back("error=forbidden");
  const jar = await cookies();
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const stored = jar.get("vmw_gstate")?.value ?? "";
  jar.delete("vmw_gstate");
  const [wsId, nonce, sig] = state.split(".");
  if (!state || state !== stored || wsId !== ctx.workspace.id || !safeEqual(sig ?? "", hmac(`${wsId}.${ctx.user.id}.${nonce}`))) return back("error=state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return back("error=denied");
  try {
    const t = await exchangeCode(code);
    let email: string | null = null;
    if (t.id_token) {
      try { email = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString()).email ?? null; } catch {}
    }
    const data = { status: "CONNECTED", accountEmail: email, accessTokenEnc: encrypt(t.access_token), refreshTokenEnc: t.refresh_token ? encrypt(t.refresh_token) : null, expiresAt: new Date(Date.now() + t.expires_in * 1000), lastError: null, connectedById: ctx.user.id };
    await db.integration.upsert({ where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider: "GOOGLE_DRIVE" } }, create: { workspaceId: ctx.workspace.id, provider: "GOOGLE_DRIVE", ...data }, update: data });
    await db.auditLog.create({ data: { actorId: ctx.user.id, actorEmail: ctx.user.email, scope: "WORKSPACE", workspaceId: ctx.workspace.id, action: "INTEGRATION_CONNECTED", targetType: "INTEGRATION", targetId: "GOOGLE_DRIVE" } });
    return back("connected=1");
  } catch {
    return back("error=exchange");
  }
}
