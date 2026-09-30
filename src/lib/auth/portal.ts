import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireVerifiedUser, isUuid } from "./context";
import { notFound } from "@/lib/errors";

export const PORTAL_COOKIE = "vmw_portal";

/**
 * Client portal context. A portal user sees ONLY data of the client(s) they were
 * explicitly granted, and ONLY records marked CLIENT_VISIBLE. All filters are applied
 * in the database query — internal content never leaves the server.
 */
export const requirePortal = cache(async () => {
  const user = await requireVerifiedUser();
  const access = await db.clientPortalAccess.findMany({
    where: { userId: user.id, revokedAt: null, client: { archivedAt: null } },
    include: { client: { include: { workspace: { include: { settings: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (!access.length) redirect("/app");
  const jar = await cookies();
  const hint = jar.get(PORTAL_COOKIE)?.value;
  const current = access.find((a) => a.clientId === hint) ?? access[0];
  return { user, access, current, client: current.client, workspace: current.client.workspace };
});

export type PortalCtx = Awaited<ReturnType<typeof requirePortal>>;

export function portalProjectWhere(ctx: PortalCtx): Prisma.ProjectWhereInput {
  return { clientId: ctx.client.id, workspaceId: ctx.workspace.id, portalEnabled: true, archivedAt: null };
}

export async function getPortalProject(ctx: PortalCtx, projectId: string) {
  if (!isUuid(projectId)) throw notFound();
  const project = await db.project.findFirst({ where: { id: projectId, ...portalProjectWhere(ctx) } });
  if (!project) throw notFound("Project not found.");
  return project;
}
