import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceCtx, projectScope } from "@/lib/auth/context";
import { getSessionUser } from "@/lib/auth/session";
import { getSiteShot, type ShotDevice } from "@/server/services/screenshot";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Screenshot of a website linked to one of the caller's projects (project website or preview).
 * Taken by our own headless browser and cached, so it works for sites that refuse to be framed.
 */
export async function GET(req: NextRequest) {
  const ctx = await getWorkspaceCtx();
  const user = ctx ? null : await getSessionUser();
  if (!ctx && !user) return new NextResponse("Unauthorized", { status: 401 });
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const device: ShotDevice = req.nextUrl.searchParams.get("d") === "mobile" ? "mobile" : "desktop";
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  if (!/^https?:\/\//i.test(url) || url.length > 2000) return new NextResponse("Bad request", { status: 400 });
  // Only sites this workspace actually tracks: this is not an open screenshot proxy.
  let known = 0;
  if (ctx) {
    const scope = projectScope(ctx);
    known = (await db.project.count({ where: { ...scope, websiteUrl: url } })) + (await db.preview.count({ where: { url, project: scope } }));
  } else if (user) {
    // Client portal: only sites of projects shared with this client.
    const access = await db.clientPortalAccess.findMany({ where: { userId: user.id, revokedAt: null }, select: { clientId: true } });
    const scope = { clientId: { in: access.map((a) => a.clientId) }, portalEnabled: true, archivedAt: null };
    known = access.length ? (await db.project.count({ where: { ...scope, websiteUrl: url } })) + (await db.preview.count({ where: { url, visibility: "CLIENT_VISIBLE", project: scope } })) : 0;
  }
  if (!known) return new NextResponse("Not found", { status: 404 });
  try {
    const data = await getSiteShot(url, device, fresh);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=1800", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    console.error("site-shot failed", url, e instanceof Error ? e.message : e);
    return new NextResponse("Screenshot failed", { status: 502 });
  }
}
