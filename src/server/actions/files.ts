"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireWorkspace, getProjectAccess, isUuid } from "@/lib/auth/context";
import { hasLevel } from "@/lib/auth/permissions";
import { validateUpload, presignUpload, headObject, deleteObject } from "@/lib/storage";
import { requireActiveSubscription } from "@/lib/plans";
import { emit } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";
import { resolveTarget, assertQuota, adjustStorage, categorize } from "@/server/services/files";

const uploadReq = z.object({
  name: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().max(120),
  size: z.number().int().positive(),
  visibility: z.enum(["INTERNAL", "CLIENT_VISIBLE"]).default("INTERNAL"),
  category: z.string().max(20).optional(),
  target: z.object({ projectId: z.string().nullish(), clientId: z.string().nullish(), phaseId: z.string().nullish(), taskId: z.string().nullish(), deliverableVersionId: z.string().nullish(), invoiceId: z.string().nullish(), expenseId: z.string().nullish() }),
});

function safeName(n: string) {
  return n.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "file";
}

/** Step 1: quota + type check, then a short-lived presigned PUT URL for direct-to-storage upload. */
export async function requestUploadAction(input: z.input<typeof uploadReq>) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireActiveSubscription(ctx.workspace.id);
    await rateLimit("upload", 200, 3600, ctx.user.id);
    const i = uploadReq.parse(input);
    validateUpload(i.mimeType, i.size);
    const target = await resolveTarget(ctx, i.target);
    await assertQuota(ctx.workspace.id, i.size);
    const key = `ws/${ctx.workspace.id}/${crypto.randomUUID()}/${safeName(i.name)}`;
    const file = await db.file.create({
      data: { workspaceId: ctx.workspace.id, ...target, name: i.name, mimeType: i.mimeType, sizeBytes: BigInt(i.size), storageKey: key, status: "PENDING", category: categorize(i.mimeType, i.category), visibility: i.visibility, uploadedById: ctx.user.id },
    });
    return { fileId: file.id, ...(await presignUpload(key, i.mimeType, i.size)) };
  });
}

/** Step 2: verify the object really exists with the declared size before counting it. */
export async function completeUploadAction(fileId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    if (!isUuid(fileId)) throw notFound();
    const file = await db.file.findFirst({ where: { id: fileId, workspaceId: ctx.workspace.id, uploadedById: ctx.user.id, status: "PENDING" } });
    if (!file || !file.storageKey) throw notFound("Upload not found.");
    const head = await headObject(file.storageKey).catch(() => null);
    if (!head) throw new AppError("Upload failed — the file didn't reach storage. Please retry.");
    if (head.size !== Number(file.sizeBytes)) {
      await deleteObject(file.storageKey).catch(() => {});
      await db.file.delete({ where: { id: file.id } });
      throw new AppError("Upload was corrupted (size mismatch). Please retry.");
    }
    await assertQuota(ctx.workspace.id, head.size).catch(async (e) => {
      await deleteObject(file.storageKey!).catch(() => {});
      await db.file.delete({ where: { id: file.id } });
      throw e;
    });
    await db.file.update({ where: { id: file.id }, data: { status: "READY" } });
    await adjustStorage(ctx.workspace.id, head.size);
    if (file.projectId) {
      const project = await db.project.findUnique({ where: { id: file.projectId } });
      const visible = file.visibility === "CLIENT_VISIBLE";
      await emit({
        workspaceId: ctx.workspace.id, type: "FILE_UPLOADED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: file.projectId, clientId: file.clientId, entityType: "FILE", entityId: file.id,
        summary: ["Uploaded {name}", { name: file.name }], clientVisible: visible,
        notify: visible && project ? { client: true, title: ["New file in {project}", { project: project.name }], message: ["{name}", { name: file.name }], clientActionUrl: `/portal/projects/${project.id}/files`, actionLabel: "View files" } : undefined,
      });
    }
    return { id: file.id };
  });
}

export async function updateFileAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200), visibility: z.enum(["INTERNAL", "CLIENT_VISIBLE"]), category: z.enum(["DOCUMENT", "IMAGE", "CONTRACT", "INVOICE", "DELIVERABLE", "OTHER"]) }).parse(Object.fromEntries(fd));
    const file = await loadManageableFile(ctx, i.id);
    await db.file.update({ where: { id: file.id }, data: { name: i.name, visibility: i.visibility, category: i.category } });
    return null;
  }, "File updated.");
}

export async function deleteFileAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const file = await loadManageableFile(ctx, id);
    // Recoverable: the bytes are kept 30 days ("Recently deleted"), then purged by the daily job.
    await db.file.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
    if (file.source === "UPLOAD" && file.storageKey && file.status === "READY") await adjustStorage(ctx.workspace.id, -Number(file.sizeBytes));
    await emit({ workspaceId: ctx.workspace.id, type: "FILE_DELETED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: file.projectId, clientId: file.clientId, entityType: "FILE", entityId: file.id, summary: ["Deleted {name}", { name: file.name }] });
    return null;
  }, "File deleted. You can restore it for 30 days.");
}

/** Bring back a file deleted less than 30 days ago. */
export async function restoreFileAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    if (!isUuid(id)) throw notFound();
    const file = await db.file.findFirst({ where: { id, workspaceId: ctx.workspace.id, deletedAt: { not: null } } });
    if (!file) throw notFound("File not found.");
    if (file.projectId) {
      const { perms } = await getProjectAccess(ctx, file.projectId);
      if (!hasLevel(perms, "files", "upload")) throw new AppError("You can't manage this file.", "FORBIDDEN");
    } else if (!hasLevel(ctx.perms, "files", "upload")) throw new AppError("You can't manage this file.", "FORBIDDEN");
    if (file.source === "UPLOAD" && file.storageKey && file.status === "READY") {
      const ok = await headObject(file.storageKey).then(() => true, () => false);
      if (!ok) throw new AppError("This file can no longer be recovered.");
      await adjustStorage(ctx.workspace.id, Number(file.sizeBytes));
    }
    await db.file.update({ where: { id: file.id }, data: { deletedAt: null } });
    await emit({ workspaceId: ctx.workspace.id, type: "FILE_RESTORED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: file.projectId, clientId: file.clientId, entityType: "FILE", entityId: file.id, summary: ["Restored {name}", { name: file.name }] });
    return null;
  }, "File restored.");
}

async function loadManageableFile(ctx: Awaited<ReturnType<typeof requireWorkspace>>, id: string) {
  if (!isUuid(id)) throw notFound();
  const file = await db.file.findFirst({ where: { id, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!file) throw notFound("File not found.");
  if (file.projectId) {
    const { perms } = await getProjectAccess(ctx, file.projectId);
    if (!hasLevel(perms, "files", "upload")) throw new AppError("You can't manage this file.", "FORBIDDEN");
  } else if (!hasLevel(ctx.perms, "files", "upload")) throw new AppError("You can't manage this file.", "FORBIDDEN");
  return file;
}

/** Share a file with the client, or make it internal again (one click from the file card). */
export async function setFileVisibilityAction(id: string, visibility: "INTERNAL" | "CLIENT_VISIBLE") {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const v = z.enum(["INTERNAL", "CLIENT_VISIBLE"]).parse(visibility);
    const file = await loadManageableFile(ctx, id);
    await db.file.update({ where: { id: file.id }, data: { visibility: v } });
    if (v === "CLIENT_VISIBLE" && file.projectId) {
      const project = await db.project.findUnique({ where: { id: file.projectId } });
      if (project)
        await emit({
          workspaceId: ctx.workspace.id, type: "FILE_UPLOADED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: project.clientId, entityType: "FILE", entityId: file.id,
          summary: ["Shared {name}", { name: file.name }], clientVisible: true,
          notify: { client: true, title: ["New file in {project}", { project: project.name }], message: ["{name}", { name: file.name }], clientActionUrl: `/portal/projects/${project.id}/files`, actionLabel: "View files" },
        });
    }
    return null;
  }, visibility === "CLIENT_VISIBLE" ? "Shared with the client." : "File is now internal.");
}

/** Attach a file to a project (and its client) — or detach it. */
export async function moveFileAction(id: string, projectId: string | null) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const file = await loadManageableFile(ctx, id);
    if (projectId) {
      if (!isUuid(projectId)) throw notFound();
      const { perms } = await getProjectAccess(ctx, projectId);
      if (!hasLevel(perms, "files", "upload")) throw new AppError("You can't manage this file.", "FORBIDDEN");
      const project = await db.project.findFirstOrThrow({ where: { id: projectId, workspaceId: ctx.workspace.id } });
      await db.file.update({ where: { id: file.id }, data: { projectId: project.id, clientId: project.clientId } });
    } else await db.file.update({ where: { id: file.id }, data: { projectId: null } });
    return null;
  }, "File moved.");
}
