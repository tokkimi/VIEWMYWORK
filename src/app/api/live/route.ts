import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getWorkspaceCtx, projectScope, isUuid } from "@/lib/auth/context";
import { getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * A fingerprint of everything that can change on a project page. Open pages poll it and refresh
 * when it changes, so the professional and the client see the same shared content at the same time.
 * Portal users only get a fingerprint of client-visible data (it never reflects internal changes).
 */
async function stamp(projectIds: string[], clientOnly: boolean) {
  if (!projectIds.length) return "none";
  const inProjects = { projectId: { in: projectIds } };
  const vis = clientOnly ? { visibility: "CLIENT_VISIBLE" as const } : {};
  const files: Prisma.FileWhereInput = { ...inProjects, ...vis, status: "READY" };
  const [act, fileAgg, fileGone, msg, cr, del, task, proj, inv] = await Promise.all([
    db.activityLog.aggregate({ where: { ...inProjects, ...(clientOnly ? { clientVisible: true } : {}) }, _max: { createdAt: true }, _count: true }),
    db.file.aggregate({ where: { ...files, deletedAt: null }, _max: { createdAt: true }, _count: true }),
    db.file.aggregate({ where: files, _max: { deletedAt: true } }),
    db.message.aggregate({ where: { ...inProjects, ...vis }, _max: { createdAt: true }, _count: true }),
    db.changeRequest.aggregate({ where: inProjects, _max: { updatedAt: true }, _count: true }),
    db.deliverable.aggregate({ where: { ...inProjects, ...vis }, _max: { updatedAt: true }, _count: true }),
    db.task.aggregate({ where: { ...inProjects, ...vis }, _max: { updatedAt: true }, _count: true }),
    db.project.aggregate({ where: { id: { in: projectIds } }, _max: { updatedAt: true } }),
    db.invoice.aggregate({ where: { ...inProjects, ...(clientOnly ? { status: { not: "DRAFT" } } : {}) }, _max: { updatedAt: true }, _count: true }),
  ]);
  const parts = [act, fileAgg, fileGone, msg, cr, del, task, proj, inv].map((x) => JSON.stringify(x));
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p");
  const headers = { "Cache-Control": "no-store" };
  const ctx = await getWorkspaceCtx();
  if (ctx && p && isUuid(p)) {
    const ok = await db.project.count({ where: { id: p, ...projectScope(ctx) } });
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    return NextResponse.json({ s: await stamp([p], false) }, { headers });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const access = await db.clientPortalAccess.findMany({ where: { userId: user.id, revokedAt: null }, select: { clientId: true } });
  const projects = await db.project.findMany({ where: { clientId: { in: access.map((a) => a.clientId) }, portalEnabled: true, archivedAt: null, ...(p && isUuid(p) ? { id: p } : {}) }, select: { id: true } });
  return NextResponse.json({ s: await stamp(projects.map((x) => x.id), true) }, { headers });
}
