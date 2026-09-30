"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireWorkspace, requirePerm, requireVerifiedUser, requireProjectPerm, WORKSPACE_COOKIE, isUuid } from "@/lib/auth/context";
import { PORTAL_COOKIE } from "@/lib/auth/portal";
import { CAPABILITIES, sanitizePermissions, ROLE_LABELS } from "@/lib/auth/permissions";
import { formToObject, zEmail, zOptStr, zId } from "@/lib/validation";
import { assertWithinLimit } from "@/lib/plans";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { emit } from "@/lib/events";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { getLocale } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";

const ROLE = z.enum(["ADMIN", "PROJECT_MANAGER", "COLLABORATOR", "VIEWER"]);

function permsFromForm(fd: FormData) {
  const raw: Record<string, string> = {};
  for (const cap of Object.keys(CAPABILITIES)) {
    const v = fd.get(`perm_${cap}`);
    if (typeof v === "string" && v !== "default") raw[cap] = v;
  }
  return sanitizePermissions(raw);
}

async function audit(ctx: Awaited<ReturnType<typeof requireWorkspace>>, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonValue) {
  await db.auditLog.create({ data: { actorId: ctx.user.id, actorEmail: ctx.user.email, scope: "WORKSPACE", workspaceId: ctx.workspace.id, action, targetType, targetId, metadata } });
}

export async function inviteMemberAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "team", "manage");
    await rateLimit("invite-member", 30, 3600, ctx.workspace.id);
    const i = z.object({ email: zEmail, role: ROLE, title: zOptStr(60), allProjects: z.string().optional() }).parse(formToObject(fd));
    if (i.role === "ADMIN" && ctx.member.role !== "OWNER") throw new AppError("Only the owner can invite admins.", "FORBIDDEN");
    await assertWithinLimit(ctx.workspace.id, "collaborators");
    const perms = permsFromForm(fd);
    const projectIds = fd.getAll("projectIds").map(String).filter(isUuid);
    const validProjects = projectIds.length ? await db.project.findMany({ where: { id: { in: projectIds }, workspaceId: ctx.workspace.id }, select: { id: true } }) : [];
    const existingUser = await db.user.findUnique({ where: { email: i.email } });
    if (existingUser && (await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: existingUser.id } } }))) throw new AppError("This person is already a member.", "CONFLICT");
    await db.invitation.updateMany({ where: { workspaceId: ctx.workspace.id, email: i.email, kind: "MEMBER", acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const token = randomToken(32);
    const inv = await db.invitation.create({
      data: { workspaceId: ctx.workspace.id, kind: "MEMBER", email: i.email, role: i.role, title: i.title, permissions: { ...perms, allProjects: Boolean(i.allProjects) }, projectIds: validProjects.map((p) => p.id), tokenHash: sha256(token), invitedById: ctx.user.id, expiresAt: new Date(Date.now() + 7 * 86400_000) },
    });
    const link = `${env.appUrl}/invite/${token}`;
    const t = emailTemplates.collaboratorInvitation({ brand: { name: ctx.workspace.name, logoUrl: ctx.workspace.logoUrl }, inviter: ctx.user.name, role: i.title || ROLE_LABELS[i.role], link }, await getLocale());
    const r = await sendEmail({ to: i.email, subject: t.subject, html: t.html, template: "collaborator_invitation", workspaceId: ctx.workspace.id, entityType: "INVITATION", entityId: inv.id, fromName: ctx.workspace.name });
    await emit({ workspaceId: ctx.workspace.id, type: "COLLABORATOR_INVITED", actor: { id: ctx.user.id, name: ctx.user.name }, entityType: "INVITATION", entityId: inv.id, summary: ["Invited {email} as {role}", { email: i.email, role: { t: ROLE_LABELS[i.role] } }] });
    return { link, emailStatus: r.status };
  });
}

export async function revokeInvitationAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "team", "manage");
    const r = await db.invitation.updateMany({ where: { id, workspaceId: ctx.workspace.id, acceptedAt: null }, data: { revokedAt: new Date() } });
    if (!r.count) throw notFound();
    return null;
  }, "Invitation revoked.");
}

export async function updateMemberAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "team", "manage");
    const i = z.object({ memberId: zId, role: ROLE, title: zOptStr(60), allProjects: z.string().optional() }).parse(formToObject(fd));
    const m = await db.workspaceMember.findFirst({ where: { id: i.memberId, workspaceId: ctx.workspace.id } });
    if (!m) throw notFound();
    if (m.role === "OWNER") throw new AppError("The owner's role can't be changed.", "FORBIDDEN");
    if ((i.role === "ADMIN" || m.role === "ADMIN") && ctx.member.role !== "OWNER") throw new AppError("Only the owner can manage admins.", "FORBIDDEN");
    const permissions = permsFromForm(fd);
    await db.workspaceMember.update({ where: { id: m.id }, data: { role: i.role, title: i.title ?? null, permissions, allProjects: Boolean(i.allProjects) } });
    await audit(ctx, "MEMBER_PERMISSIONS_CHANGED", "MEMBER", m.id, { role: i.role, permissions, allProjects: Boolean(i.allProjects) });
    await emit({ workspaceId: ctx.workspace.id, type: "PERMISSION_CHANGED", actor: { id: ctx.user.id, name: ctx.user.name }, entityType: "MEMBER", entityId: m.id, summary: "Permissions updated", notify: { team: { kind: "users", userIds: [m.userId] }, title: "Your permissions changed", message: ["{user} updated your role to {role} in {workspace}.", { user: ctx.user.name, role: { t: ROLE_LABELS[i.role] }, workspace: ctx.workspace.name }], actionUrl: "/app" } });
    return null;
  }, "Member updated.");
}

export async function removeMemberAction(memberId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "team", "manage");
    const m = await db.workspaceMember.findFirst({ where: { id: memberId, workspaceId: ctx.workspace.id } });
    if (!m) throw notFound();
    if (m.role === "OWNER") throw new AppError("The owner can't be removed.", "FORBIDDEN");
    if (m.role === "ADMIN" && ctx.member.role !== "OWNER") throw new AppError("Only the owner can remove admins.", "FORBIDDEN");
    await db.$transaction([db.task.updateMany({ where: { workspaceId: ctx.workspace.id, assigneeId: m.userId }, data: { assigneeId: null } }), db.workspaceMember.delete({ where: { id: m.id } })]);
    await audit(ctx, "MEMBER_REMOVED", "MEMBER", m.id, { userId: m.userId });
    return null;
  }, "Member removed.");
}

export async function addProjectMemberAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, memberId: zId }).parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "manage");
    const m = await db.workspaceMember.findFirst({ where: { id: i.memberId, workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: true } });
    if (!m) throw notFound("Member not found.");
    await db.projectMember.upsert({ where: { projectId_memberId: { projectId: i.projectId, memberId: m.id } }, create: { projectId: i.projectId, memberId: m.id, permissions: permsFromForm(fd) }, update: { permissions: permsFromForm(fd) } });
    const project = await db.project.findUniqueOrThrow({ where: { id: i.projectId } });
    await emit({ workspaceId: ctx.workspace.id, type: "COLLABORATOR_ADDED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: i.projectId, entityType: "MEMBER", entityId: m.id, summary: ["{name} added to the project", { name: m.user.name }], notify: { team: { kind: "users", userIds: [m.userId] }, title: ["You were added to {project}", { project: project.name }], message: ["{user} added you to the project.", { user: ctx.user.name }], actionUrl: `/app/projects/${i.projectId}`, actionLabel: "Open project", email: true } });
    return null;
  }, "Collaborator added.");
}

export async function updateProjectMemberAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ id: zId }).parse(formToObject(fd));
    const pm = await db.projectMember.findFirst({ where: { id: i.id, project: { workspaceId: ctx.workspace.id } } });
    if (!pm) throw notFound();
    await requireProjectPerm(ctx, pm.projectId, "projects", "manage");
    const permissions = permsFromForm(fd);
    await db.projectMember.update({ where: { id: pm.id }, data: { permissions } });
    await audit(ctx, "PROJECT_PERMISSIONS_CHANGED", "PROJECT_MEMBER", pm.id, permissions);
    return null;
  }, "Permissions saved.");
}

export async function removeProjectMemberAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const pm = await db.projectMember.findFirst({ where: { id, project: { workspaceId: ctx.workspace.id } } });
    if (!pm) throw notFound();
    await requireProjectPerm(ctx, pm.projectId, "projects", "manage");
    await db.projectMember.delete({ where: { id } });
    return null;
  }, "Removed from project.");
}

/** Accepts a member or client invitation for the signed-in user (email must match). */
export async function acceptInvitationAction(token: string) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt < new Date()) throw new AppError("This invitation is invalid or has expired.");
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) throw new AppError(["This invitation was sent to {email}. Sign in with that address to accept it.", { email: inv.email }], "FORBIDDEN");
    const jar = await cookies();
    if (inv.kind === "MEMBER") {
      const p = (inv.permissions ?? {}) as Record<string, unknown>;
      await db.$transaction(async (tx) => {
        const claimed = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
        if (!claimed.count) throw new AppError("This invitation was already used.");
        const m = await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId: user.id } },
          create: { workspaceId: inv.workspaceId, userId: user.id, role: inv.role ?? "COLLABORATOR", title: inv.title, permissions: sanitizePermissions(p), allProjects: Boolean(p.allProjects) },
          update: { status: "ACTIVE" },
        });
        for (const projectId of inv.projectIds) await tx.projectMember.upsert({ where: { projectId_memberId: { projectId, memberId: m.id } }, create: { projectId, memberId: m.id }, update: {} });
      });
      jar.set(WORKSPACE_COOKIE, inv.workspaceId, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/" });
      await emit({ workspaceId: inv.workspaceId, type: "COLLABORATOR_ADDED", actor: { id: user.id, name: user.name }, entityType: "MEMBER", entityId: user.id, summary: ["{name} joined the workspace", { name: user.name }], notify: { team: { kind: "workspace" }, title: ["{name} joined your workspace", { name: user.name }], message: ["{email} accepted the invitation.", { email: user.email }], actionUrl: "/app/team" } });
      return { redirect: "/app" };
    }
    if (!inv.clientId) throw new AppError("Invalid invitation.");
    await db.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
      if (!claimed.count) throw new AppError("This invitation was already used.");
      await tx.clientPortalAccess.upsert({ where: { clientId_userId: { clientId: inv.clientId!, userId: user.id } }, create: { workspaceId: inv.workspaceId, clientId: inv.clientId!, userId: user.id }, update: { revokedAt: null } });
    });
    jar.set(PORTAL_COOKIE, inv.clientId, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/" });
    return { redirect: "/portal" };
  });
}
