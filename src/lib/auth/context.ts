import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Prisma, User, Workspace, WorkspaceMember } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "./session";
import { forbidden, notFound } from "@/lib/errors";
import { hasLevel, resolvePermissions, type Capability, type Level, type PermissionMap } from "./permissions";

export const WORKSPACE_COOKIE = "vmw_ws";

export type WorkspaceCtx = {
  user: User;
  workspace: Workspace;
  member: WorkspaceMember;
  perms: PermissionMap;
  isAdmin: boolean; // OWNER or ADMIN
};

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireVerifiedUser() {
  const user = await requireUser();
  if (!user.emailVerifiedAt) redirect("/verify-email");
  return user;
}

/**
 * Resolves the active workspace for the current user. The cookie is only a *hint*:
 * membership is always re-verified against the database, so tampering with it
 * can never grant access to another tenant.
 */
export const getWorkspaceCtx = cache(async (): Promise<WorkspaceCtx | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const jar = await cookies();
  const hint = jar.get(WORKSPACE_COOKIE)?.value;
  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id, status: "ACTIVE", workspace: { archivedAt: null } },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (!memberships.length) return null;
  const m = memberships.find((x) => x.workspaceId === hint) ?? memberships[0];
  return {
    user,
    workspace: m.workspace,
    member: m,
    perms: resolvePermissions(m.role, m.permissions),
    isAdmin: m.role === "OWNER" || m.role === "ADMIN",
  };
});

/** For pages/actions of the professional app. */
export async function requireWorkspace(): Promise<WorkspaceCtx> {
  const user = await requireVerifiedUser();
  const ctx = await getWorkspaceCtx();
  if (!ctx) {
    const portal = await db.clientPortalAccess.findFirst({ where: { userId: user.id, revokedAt: null } });
    redirect(portal ? "/portal" : "/onboarding");
  }
  return ctx;
}

export function requirePerm<C extends Capability>(ctx: WorkspaceCtx, cap: C, min: Level<C>) {
  if (!hasLevel(ctx.perms, cap, min)) throw forbidden();
}

export function can<C extends Capability>(ctx: WorkspaceCtx, cap: C, min: Level<C>) {
  return hasLevel(ctx.perms, cap, min);
}

/** Prisma filter selecting only the projects this member may access, always tenant-scoped. */
export function projectScope(ctx: WorkspaceCtx): Prisma.ProjectWhereInput {
  if (ctx.isAdmin || ctx.member.allProjects) return { workspaceId: ctx.workspace.id };
  return { workspaceId: ctx.workspace.id, members: { some: { memberId: ctx.member.id } } };
}

/**
 * Loads a project the member may access, and the effective permissions for it
 * (role defaults + member overrides + project-level overrides).
 * Throws NOT_FOUND (not FORBIDDEN) to avoid leaking existence across tenants.
 */
export async function getProjectAccess(ctx: WorkspaceCtx, projectId: string) {
  if (!isUuid(projectId)) throw notFound("Project not found.");
  const project = await db.project.findFirst({
    where: { id: projectId, ...projectScope(ctx) },
    include: { members: { where: { memberId: ctx.member.id } } },
  });
  if (!project) throw notFound("Project not found.");
  const perms = resolvePermissions(ctx.member.role, ctx.member.permissions, project.members[0]?.permissions);
  return { project, perms };
}

export async function requireProjectPerm<C extends Capability>(ctx: WorkspaceCtx, projectId: string, cap: C, min: Level<C>) {
  const access = await getProjectAccess(ctx, projectId);
  if (!hasLevel(access.perms, cap, min)) throw forbidden();
  return access;
}

export async function requireSuperAdmin() {
  const user = await requireVerifiedUser();
  if (user.platformRole !== "SUPER_ADMIN") redirect("/app");
  return user;
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
