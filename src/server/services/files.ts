import type { File as FileRow, Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { getProjectAccess, isUuid, projectScope, type WorkspaceCtx } from "@/lib/auth/context";
import { hasLevel, resolvePermissions } from "@/lib/auth/permissions";
import { storageQuota, formatBytes } from "@/lib/plans";
import { notifyWorkspaceAdmins } from "@/lib/events";

export type UploadTarget = {
  projectId?: string | null;
  clientId?: string | null;
  phaseId?: string | null;
  taskId?: string | null;
  deliverableVersionId?: string | null;
  invoiceId?: string | null;
  expenseId?: string | null;
};

/** Validates that every referenced parent belongs to the workspace and is accessible. Returns normalised ids. */
export async function resolveTarget(ctx: WorkspaceCtx, t: UploadTarget) {
  const ws = ctx.workspace.id;
  const out: UploadTarget = {};
  for (const v of Object.values(t)) if (v && !isUuid(v)) throw notFound();
  if (t.taskId) {
    const task = await db.task.findFirst({ where: { id: t.taskId, workspaceId: ws } });
    if (!task) throw notFound("Task not found.");
    out.taskId = task.id;
    out.projectId = task.projectId;
    out.phaseId = task.phaseId;
  }
  if (t.deliverableVersionId) {
    const v = await db.deliverableVersion.findFirst({ where: { id: t.deliverableVersionId, deliverable: { workspaceId: ws } }, include: { deliverable: true } });
    if (!v) throw notFound("Deliverable not found.");
    out.deliverableVersionId = v.id;
    out.projectId = v.deliverable.projectId;
  }
  if (t.phaseId && !out.phaseId) {
    const ph = await db.phase.findFirst({ where: { id: t.phaseId, project: { workspaceId: ws } } });
    if (!ph) throw notFound("Phase not found.");
    out.phaseId = ph.id;
    out.projectId = ph.projectId;
  }
  if (t.projectId && !out.projectId) out.projectId = t.projectId;
  if (out.projectId) {
    const { project, perms } = await getProjectAccess(ctx, out.projectId);
    if (!hasLevel(perms, "files", "upload")) throw new AppError("You can't upload files to this project.", "FORBIDDEN");
    out.clientId = project.clientId;
  } else if (!hasLevel(ctx.perms, "files", "upload")) throw new AppError("You can't upload files.", "FORBIDDEN");
  if (t.clientId && !out.clientId) {
    if (!hasLevel(ctx.perms, "clients", "view")) throw new AppError("You can't upload client files.", "FORBIDDEN");
    const c = await db.client.findFirst({ where: { id: t.clientId, workspaceId: ws } });
    if (!c) throw notFound("Client not found.");
    out.clientId = c.id;
  }
  if (t.invoiceId) {
    if (!hasLevel(ctx.perms, "invoices", "edit")) throw new AppError("You can't attach files to invoices.", "FORBIDDEN");
    const inv = await db.invoice.findFirst({ where: { id: t.invoiceId, workspaceId: ws } });
    if (!inv) throw notFound("Invoice not found.");
    out.invoiceId = inv.id;
    out.clientId ??= inv.clientId;
  }
  if (t.expenseId) {
    if (!hasLevel(ctx.perms, "finance", "edit")) throw new AppError("You can't attach receipts.", "FORBIDDEN");
    const e = await db.expense.findFirst({ where: { id: t.expenseId, workspaceId: ws } });
    if (!e) throw notFound("Expense not found.");
    out.expenseId = e.id;
  }
  return out;
}

export async function assertQuota(workspaceId: string, addBytes: number) {
  const q = await storageQuota(workspaceId);
  if (q.limit !== null && q.used + BigInt(addBytes) > q.limit)
    throw new AppError(`Storage is full (${formatBytes(q.used)} of ${formatBytes(q.limit)} used). Delete files or upgrade your plan.`, "LIMIT");
}

/** Atomically adjusts storage usage and warns admins when crossing 90%. */
export async function adjustStorage(workspaceId: string, delta: number) {
  const before = await storageQuota(workspaceId);
  await db.workspace.update({ where: { id: workspaceId }, data: { storageUsedBytes: { increment: BigInt(delta) } } });
  if (delta > 0 && before.limit !== null) {
    const after = before.used + BigInt(delta);
    if (before.used * 10n < before.limit * 9n && after * 10n >= before.limit * 9n)
      await notifyWorkspaceAdmins(workspaceId, "STORAGE_ALMOST_FULL", "Storage almost full", `You've used ${formatBytes(after)} of ${formatBytes(before.limit)}. Upgrade your plan or remove files to keep uploading.`, "/app/settings/storage");
  }
}

/** Can a workspace member read this file? */
export async function memberCanReadFile(userId: string, file: FileRow) {
  const m = await db.workspaceMember.findFirst({ where: { userId, workspaceId: file.workspaceId, status: "ACTIVE" } });
  if (!m) return false;
  const base = resolvePermissions(m.role, m.permissions);
  if (file.invoiceId && !hasLevel(base, "invoices", "view")) return false;
  if (file.expenseId && !hasLevel(base, "finance", "view")) return false;
  if (!file.projectId) return hasLevel(base, "files", "view") && (!file.clientId || hasLevel(base, "clients", "view") || !!file.taskId);
  const admin = m.role === "OWNER" || m.role === "ADMIN" || m.allProjects;
  const pm = await db.projectMember.findFirst({ where: { projectId: file.projectId, memberId: m.id } });
  if (!admin && !pm) return false;
  return hasLevel(resolvePermissions(m.role, m.permissions, pm?.permissions), "files", "view");
}

/** Can a portal (client) user read this file? Only CLIENT_VISIBLE files of their client's portal-enabled projects. */
export async function clientCanReadFile(userId: string, file: FileRow) {
  if (file.visibility !== "CLIENT_VISIBLE" || !file.clientId) return false;
  const access = await db.clientPortalAccess.findFirst({ where: { userId, clientId: file.clientId, workspaceId: file.workspaceId, revokedAt: null } });
  if (!access) return false;
  if (file.projectId) {
    const p = await db.project.findFirst({ where: { id: file.projectId, clientId: file.clientId, portalEnabled: true } });
    if (!p) return false;
  }
  if (file.deliverableVersionId) {
    const v = await db.deliverableVersion.findFirst({ where: { id: file.deliverableVersionId, deliverable: { visibility: "CLIENT_VISIBLE" } } });
    if (!v) return false;
  }
  return true;
}

export function fileWhereForMember(ctx: WorkspaceCtx) {
  return { workspaceId: ctx.workspace.id, deletedAt: null, status: "READY", OR: [{ projectId: null }, { project: projectScope(ctx) }] };
}

export function categorize(mime: string, requested?: string | null) {
  const allowed = ["DOCUMENT", "IMAGE", "CONTRACT", "INVOICE", "DELIVERABLE", "OTHER"];
  if (requested && allowed.includes(requested)) return requested;
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime === "application/pdf" || mime.includes("word") || mime.includes("sheet") || mime.includes("presentation") || mime.startsWith("text/")) return "DOCUMENT";
  return "OTHER";
}

export const VISIBILITIES: Visibility[] = ["INTERNAL", "CLIENT_VISIBLE"];
