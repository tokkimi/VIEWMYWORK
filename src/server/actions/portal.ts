"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { isUuid } from "@/lib/auth/context";
import { formToObject, zId } from "@/lib/validation";
import { emit } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";
import { validateUpload, presignUpload, headObject, deleteObject } from "@/lib/storage";
import { assertQuota, adjustStorage, categorize } from "@/server/services/files";
import { recalcProject } from "@/lib/progress";
import { renderMsg, withSourceMsg, type Msg } from "@/lib/i18n/core";
import type { Prisma } from "@prisma/client";

async function loadReviewable(deliverableId: string) {
  const ctx = await requirePortal();
  if (!isUuid(deliverableId)) throw notFound();
  const d = await db.deliverable.findFirst({ where: { id: deliverableId, visibility: "CLIENT_VISIBLE", project: { clientId: ctx.client.id, workspaceId: ctx.workspace.id, portalEnabled: true, archivedAt: null } }, include: { project: true } });
  if (!d) throw notFound("Deliverable not found.");
  return { ctx, d };
}

/** Records a client decision. Approvals are append-only and bound to the exact version reviewed. */
export async function decideDeliverableAction(fd: FormData) {
  return runAction(async () => {
    const i = z.object({ deliverableId: zId, version: z.coerce.number().int().min(1), decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]), comment: z.string().trim().max(5000).optional() }).parse(formToObject(fd));
    const { ctx, d } = await loadReviewable(i.deliverableId);
    await rateLimit("decide", 30, 3600, ctx.user.id);
    if (i.decision === "CHANGES_REQUESTED" && !i.comment) throw new AppError("Please describe the changes you'd like.", "INVALID");
    if (!d.requiresApproval) throw new AppError("This deliverable doesn't require approval.");
    if (d.status !== "WAITING_FOR_CLIENT") throw new AppError("This deliverable isn't awaiting your review.");
    if (i.version !== d.currentVersion) throw new AppError("A newer version is available. Refresh to review it.", "CONFLICT");

    await db.$transaction(async (tx) => {
      const updated = await tx.deliverable.updateMany({ where: { id: d.id, status: "WAITING_FOR_CLIENT", currentVersion: i.version }, data: { status: i.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED" } });
      if (!updated.count) throw new AppError("This deliverable was already reviewed.", "CONFLICT");
      await tx.approval.create({ data: { workspaceId: ctx.workspace.id, deliverableId: d.id, version: i.version, decision: i.decision, comment: i.comment || null, clientId: ctx.client.id, userId: ctx.user.id, userName: ctx.user.name } });
      await tx.clientWait.updateMany({ where: { entityType: "DELIVERABLE", entityId: d.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
      await tx.specHistory.create({ data: { projectId: d.projectId, actorId: ctx.user.id, actorName: `${ctx.user.name} (client)`, change: i.decision === "APPROVED" ? `Client approved ${d.title} V${i.version}` : `Client requested changes to ${d.title} V${i.version}` } });
    });
    const approved = i.decision === "APPROVED";
    await emit({
      workspaceId: ctx.workspace.id, type: approved ? "CLIENT_APPROVED_DELIVERABLE" : "CLIENT_REQUESTED_CHANGES", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: d.projectId, clientId: ctx.client.id, entityType: "DELIVERABLE", entityId: d.id,
      summary: [approved ? "Approved {name} V{v}" : "Requested changes to {name} V{v}", { name: d.title, v: i.version }], clientVisible: true,
      notify: { team: { kind: "project" }, title: [approved ? "{name} V{v} approved" : "Changes requested on {name} V{v}", { name: d.title, v: i.version }], message: approved ? [i.comment ? "{user} approved {name}.\n\n“{comment}”" : "{user} approved {name}.", { user: ctx.user.name, name: d.title, comment: i.comment }] : `${ctx.user.name}: “${i.comment}”`, actionUrl: `/app/projects/${d.projectId}/deliverables#${d.id}`, actionLabel: approved ? "Open deliverable" : "View request", email: true },
    });
    return null;
  }, "Thank you — your decision was recorded.");
}

export async function markDeliverableViewed(deliverableId: string) {
  try {
    const { ctx, d } = await loadReviewable(deliverableId);
    const already = await db.activityLog.findFirst({ where: { workspaceId: ctx.workspace.id, action: "CLIENT_VIEWED_DELIVERABLE", entityId: d.id, actorId: ctx.user.id, metadata: { path: ["version"], equals: d.currentVersion } } });
    if (already) return;
    await emit({ workspaceId: ctx.workspace.id, type: "CLIENT_VIEWED_DELIVERABLE", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: d.projectId, clientId: ctx.client.id, entityType: "DELIVERABLE", entityId: d.id, summary: ["Viewed {name} V{v}", { name: d.title, v: d.currentVersion }], metadata: { version: d.currentVersion }, notify: { team: { kind: "project" }, title: "Client viewed a deliverable", message: ["{user} opened {name} V{v}.", { user: ctx.user.name, name: d.title, v: d.currentVersion }], actionUrl: `/app/projects/${d.projectId}/deliverables#${d.id}` } });
  } catch {
    // Viewing tracking is best-effort.
  }
}

export async function postPortalMessageAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePortal();
    await rateLimit("portal-message", 60, 3600, ctx.user.id);
    const i = z.object({ projectId: zId, body: z.string().trim().min(1, "Write a message.").max(10000), entityType: z.enum(["PROJECT", "DELIVERABLE", "INVOICE"]).default("PROJECT"), entityId: z.string().optional() }).parse(formToObject(fd));
    const project = await getPortalProject(ctx, i.projectId);
    const entityId = i.entityId && isUuid(i.entityId) ? i.entityId : project.id;
    if (i.entityType === "DELIVERABLE" && !(await db.deliverable.findFirst({ where: { id: entityId, projectId: project.id, visibility: "CLIENT_VISIBLE" } }))) throw notFound();
    if (i.entityType === "INVOICE" && !(await db.invoice.findFirst({ where: { id: entityId, clientId: ctx.client.id, status: { not: "DRAFT" } } }))) throw notFound();
    const msg = await db.message.create({ data: { workspaceId: ctx.workspace.id, projectId: project.id, entityType: i.entityType, entityId, visibility: "CLIENT_VISIBLE", body: i.body, authorId: ctx.user.id, authorName: ctx.user.name, fromClient: true } });
    await db.clientWait.updateMany({ where: { projectId: project.id, reason: "INFORMATION", resolvedAt: null, entityType: null }, data: { resolvedAt: new Date() } });
    await emit({
      workspaceId: ctx.workspace.id, type: "CLIENT_COMMENTED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: ctx.client.id, entityType: "MESSAGE", entityId: msg.id, summary: "Client sent a message", clientVisible: true,
      notify: { team: { kind: "project", capability: ["messages", "view"] }, title: ["{user} commented on {project}", { user: ctx.user.name, project: project.name }], message: i.body.slice(0, 400), actionUrl: `/app/projects/${project.id}/messages`, actionLabel: "Reply", email: true },
    });
    return null;
  });
}

// ───────── Client uploads (always client-visible, counted against the professional's quota) ─────────

export async function requestPortalUploadAction(input: { name: string; mimeType: string; size: number; target: { projectId?: string } }) {
  return runAction(async () => {
    const ctx = await requirePortal();
    await rateLimit("portal-upload", 60, 3600, ctx.user.id);
    const i = z.object({ name: z.string().trim().min(1).max(200), mimeType: z.string().max(120), size: z.number().int().positive(), target: z.object({ projectId: zId }) }).parse(input);
    const project = await getPortalProject(ctx, i.target.projectId);
    validateUpload(i.mimeType, i.size);
    await assertQuota(ctx.workspace.id, i.size);
    const key = `ws/${ctx.workspace.id}/${crypto.randomUUID()}/${i.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120)}`;
    const file = await db.file.create({ data: { workspaceId: ctx.workspace.id, projectId: project.id, clientId: ctx.client.id, name: i.name, mimeType: i.mimeType, sizeBytes: BigInt(i.size), storageKey: key, status: "PENDING", category: categorize(i.mimeType), visibility: "CLIENT_VISIBLE", uploadedById: ctx.user.id, uploadedByClient: true } });
    return { fileId: file.id, ...(await presignUpload(key, i.mimeType, i.size)) };
  });
}

export async function completePortalUploadAction(fileId: string) {
  return runAction(async () => {
    const ctx = await requirePortal();
    if (!isUuid(fileId)) throw notFound();
    const file = await db.file.findFirst({ where: { id: fileId, clientId: ctx.client.id, uploadedById: ctx.user.id, status: "PENDING" } });
    if (!file?.storageKey || !file.projectId) throw notFound("Upload not found.");
    const head = await headObject(file.storageKey).catch(() => null);
    if (!head || head.size !== Number(file.sizeBytes)) {
      if (head) await deleteObject(file.storageKey).catch(() => {});
      await db.file.delete({ where: { id: file.id } });
      throw new AppError("Upload failed. Please retry.");
    }
    await db.file.update({ where: { id: file.id }, data: { status: "READY" } });
    await adjustStorage(ctx.workspace.id, head.size);
    await db.clientWait.updateMany({ where: { projectId: file.projectId, reason: "DOCUMENT", resolvedAt: null, entityType: null }, data: { resolvedAt: new Date() } });
    const project = await db.project.findUniqueOrThrow({ where: { id: file.projectId } });
    await emit({
      workspaceId: ctx.workspace.id, type: "CLIENT_UPLOADED_FILE", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: ctx.client.id, entityType: "FILE", entityId: file.id, summary: ["Uploaded {name}", { name: file.name }], clientVisible: true,
      notify: { team: { kind: "project", capability: ["files", "view"] }, title: ["{user} uploaded a file", { user: ctx.user.name }], message: `${file.name} — ${project.name}`, actionUrl: `/app/projects/${project.id}/files`, actionLabel: "View file", email: true },
    });
    return { id: file.id };
  });
}

/**
 * The client accepts or declines a scope change the team asked them to arbitrate. Accepting applies
 * it: a task is added for the extra work, the target date moves by the extra days, the budget grows
 * by the extra cost. The team is notified either way.
 */
export async function decideScopeAsClientAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePortal();
    const i = z.object({ id: zId, decision: z.enum(["APPROVED", "REJECTED"]), comment: z.string().trim().max(2000).optional() }).parse(formToObject(fd));
    const sc = await db.scopeChange.findFirst({ where: { id: i.id, askClient: true }, include: { project: true } });
    if (!sc) throw notFound();
    const project = await getPortalProject(ctx, sc.projectId);
    if (sc.status !== "PROPOSED") throw new AppError("This decision was already made.");
    await db.$transaction(async (tx) => {
      const claimed = await tx.scopeChange.updateMany({ where: { id: sc.id, status: "PROPOSED" }, data: { status: i.decision, decidedAt: new Date(), decidedByName: ctx.user.name, clientComment: i.comment || null } });
      if (!claimed.count) throw new AppError("This decision was already made.");
      if (i.decision === "APPROVED") {
        const last = await tx.task.aggregate({ where: { projectId: project.id, phaseId: null, parentId: null }, _max: { position: true } });
        await tx.task.create({ data: { workspaceId: ctx.workspace.id, projectId: project.id, title: sc.description.split("\n")[0]!.slice(0, 140), description: sc.description, costCents: sc.additionalCostCents || null, visibility: "CLIENT_VISIBLE", position: (last._max.position ?? -1) + 1 } });
        await tx.project.update({
          where: { id: project.id },
          data: {
            ...(sc.additionalDays > 0 && sc.project.targetDate ? { targetDate: new Date(sc.project.targetDate.getTime() + sc.additionalDays * 86_400_000) } : {}),
            ...(sc.additionalCostCents > 0 && sc.project.budgetCents !== null ? { budgetCents: sc.project.budgetCents + sc.additionalCostCents } : {}),
          },
        });
        await recalcProject(tx, project.id);
      }
      const change: Msg = [i.decision === "APPROVED" ? "Scope change accepted by the client: {text}" : "Scope change declined by the client: {text}", { text: sc.description.slice(0, 120) }];
      await tx.specHistory.create({ data: { projectId: project.id, actorName: ctx.user.name, change: renderMsg("en", change), metadata: withSourceMsg(change) as Prisma.InputJsonValue | undefined } });
    });
    await emit({
      workspaceId: ctx.workspace.id, type: "SCOPE_CHANGE", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: ctx.client.id, entityType: "PROJECT", entityId: project.id,
      summary: i.decision === "APPROVED" ? "Scope change accepted by the client" : "Scope change declined by the client", clientVisible: true,
      notify: {
        team: { kind: "project", capability: ["projects", "edit"] },
        title: [i.decision === "APPROVED" ? "{user} accepted a scope change on {project}" : "{user} declined a scope change on {project}", { user: ctx.user.name, project: project.name }],
        message: i.comment ? `${sc.description.slice(0, 300)}\n\n${i.comment}` : sc.description.slice(0, 300),
        actionUrl: `/app/projects/${project.id}/specification`, actionLabel: "Open project", email: true,
      },
    });
    return null;
  }, "Thank you, your decision was sent to the team.");
}
