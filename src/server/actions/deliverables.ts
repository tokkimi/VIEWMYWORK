"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireWorkspace, requireProjectPerm, isUuid, projectScope } from "@/lib/auth/context";
import { formToObject, zId, zOptStr, zUrl, zBool } from "@/lib/validation";
import { emit } from "@/lib/events";
import { requireActiveSubscription } from "@/lib/plans";

async function loadDeliverable(ctx: Awaited<ReturnType<typeof requireWorkspace>>, id: string) {
  if (!isUuid(id)) throw notFound();
  const d = await db.deliverable.findFirst({ where: { id, workspaceId: ctx.workspace.id, project: projectScope(ctx) }, include: { project: true } });
  if (!d) throw notFound("Deliverable not found.");
  await requireProjectPerm(ctx, d.projectId, "projects", "edit");
  return d;
}

export async function createDeliverableAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireActiveSubscription(ctx.workspace.id);
    const optUrl = z.preprocess((v) => (v === "" ? undefined : v), zUrl.optional());
    const i = z
      .object({ projectId: zId, title: z.string().trim().min(1, "Title is required.").max(160), description: zOptStr(5000), previewUrl: optUrl, requiresApproval: zBool, internal: zBool, phaseId: z.preprocess((v) => (v === "" ? undefined : v), zId.optional()) })
      .parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    if (i.phaseId && !(await db.phase.findFirst({ where: { id: i.phaseId, projectId: i.projectId } }))) throw notFound("Phase not found.");
    const d = await db.deliverable.create({
      data: {
        workspaceId: ctx.workspace.id, projectId: i.projectId, phaseId: i.phaseId ?? null, title: i.title, description: i.description, requiresApproval: i.requiresApproval, visibility: i.internal ? "INTERNAL" : "CLIENT_VISIBLE",
        versions: { create: { version: 1, previewUrl: i.previewUrl, createdById: ctx.user.id } },
      },
    });
    return { id: d.id };
  }, "Deliverable created.");
}

export async function updateDeliverableAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ id: zId, title: z.string().trim().min(1).max(160), description: zOptStr(5000), requiresApproval: zBool, internal: zBool }).parse(formToObject(fd));
    const d = await loadDeliverable(ctx, i.id);
    if (i.internal && ["WAITING_FOR_CLIENT"].includes(d.status)) throw new AppError("This deliverable is awaiting client review — it can't be made internal now.");
    await db.deliverable.update({ where: { id: d.id }, data: { title: i.title, description: i.description ?? null, requiresApproval: i.requiresApproval, visibility: i.internal ? "INTERNAL" : "CLIENT_VISIBLE" } });
    return null;
  }, "Deliverable saved.");
}

/** Starts a new version after changes were requested (V1 → V2). History is preserved. */
export async function newVersionAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const optUrl = z.preprocess((v) => (v === "" ? undefined : v), zUrl.optional());
    const i = z.object({ id: zId, notes: zOptStr(5000), previewUrl: optUrl }).parse(formToObject(fd));
    const d = await loadDeliverable(ctx, i.id);
    if (d.status === "WAITING_FOR_CLIENT") throw new AppError("The current version is awaiting review.");
    const next = d.currentVersion + 1;
    await db.$transaction([
      db.deliverableVersion.create({ data: { deliverableId: d.id, version: next, notes: i.notes, previewUrl: i.previewUrl, createdById: ctx.user.id } }),
      db.deliverable.update({ where: { id: d.id }, data: { currentVersion: next, status: "DRAFT" } }),
    ]);
    return null;
  }, "New version started.");
}

export async function updateVersionAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const optUrl = z.preprocess((v) => (v === "" ? undefined : v), zUrl.optional());
    const i = z.object({ id: zId, notes: zOptStr(5000), previewUrl: optUrl }).parse(formToObject(fd));
    const d = await loadDeliverable(ctx, i.id);
    if (d.status === "APPROVED" || d.status === "WAITING_FOR_CLIENT") throw new AppError("This version is locked.");
    await db.deliverableVersion.update({ where: { deliverableId_version: { deliverableId: d.id, version: d.currentVersion } }, data: { notes: i.notes ?? null, previewUrl: i.previewUrl ?? null } });
    return null;
  }, "Version updated.");
}

/** Submits the current version. With approval required, the client is asked to Approve / Request changes. */
export async function submitDeliverableAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireActiveSubscription(ctx.workspace.id);
    const d = await loadDeliverable(ctx, id);
    if (d.status === "APPROVED") throw new AppError("Already approved. Start a new version to resubmit.");
    if (d.status === "WAITING_FOR_CLIENT") throw new AppError("Already awaiting client review.");
    if (d.visibility === "INTERNAL") throw new AppError("Make the deliverable visible to the client before submitting it.");
    const status = d.requiresApproval ? "WAITING_FOR_CLIENT" : "READY_FOR_REVIEW";
    await db.$transaction([
      db.deliverable.update({ where: { id }, data: { status } }),
      db.deliverableVersion.update({ where: { deliverableId_version: { deliverableId: id, version: d.currentVersion } }, data: { submittedAt: new Date() } }),
      ...(d.requiresApproval ? [db.clientWait.create({ data: { projectId: d.projectId, reason: "APPROVAL", label: `${d.title} V${d.currentVersion}`, entityType: "DELIVERABLE", entityId: d.id } })] : []),
    ]);
    await emit({
      workspaceId: ctx.workspace.id, type: d.requiresApproval ? "APPROVAL_REQUESTED" : "DELIVERABLE_SUBMITTED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: d.projectId, clientId: d.project.clientId, entityType: "DELIVERABLE", entityId: d.id,
      summary: [d.requiresApproval ? "{name} V{v} submitted for approval" : "{name} V{v} submitted", { name: d.title, v: d.currentVersion }], clientVisible: true,
      notify: {
        client: true,
        title: d.requiresApproval ? ["Your review is needed: {name} V{v}", { name: d.title, v: d.currentVersion }] : ["New deliverable: {name}", { name: d.title }],
        message: d.requiresApproval ? ["{workspace} submitted {name} (version {v}) for your approval.", { workspace: ctx.workspace.name, name: d.title, v: d.currentVersion }] : ["{name} (version {v}) is ready.", { name: d.title, v: d.currentVersion }],
        clientActionUrl: `/portal/projects/${d.projectId}/deliverables/${d.id}`, actionLabel: d.requiresApproval ? "Review" : "View", email: true,
      },
    });
    return null;
  }, "Deliverable submitted.");
}

export async function deleteDeliverableAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const d = await loadDeliverable(ctx, id);
    const approvals = await db.approval.count({ where: { deliverableId: id } });
    if (approvals > 0) throw new AppError("This deliverable has approval history and can't be deleted.");
    await db.$transaction([db.clientWait.updateMany({ where: { entityType: "DELIVERABLE", entityId: id, resolvedAt: null }, data: { resolvedAt: new Date() } }), db.deliverable.delete({ where: { id: d.id } })]);
    return null;
  }, "Deliverable deleted.");
}
