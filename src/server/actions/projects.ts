"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireWorkspace, requirePerm, requireProjectPerm, isUuid } from "@/lib/auth/context";
import { formToObject, zOptStr, zOptDate, zCurrency, zId, zOptMoney, zOptId, zBool } from "@/lib/validation";
import { assertWithinLimit, requireActiveSubscription } from "@/lib/plans";
import { emit } from "@/lib/events";
import { recalcProject } from "@/lib/progress";
import { getLocale } from "@/lib/i18n/server";
import { applyTemplate, assertAssignable, logSpec, snapshotSpec } from "@/server/services/spec";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(140),
  clientId: zId,
  type: zOptStr(60),
  description: zOptStr(10000),
  startDate: zOptDate,
  targetDate: zOptDate,
  managerId: zOptId,
  budget: zOptMoney,
  currency: zCurrency.default("EUR"),
  portalEnabled: zBool, // unchecked checkbox → false
});

export async function createProjectAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "projects", "manage");
    await assertWithinLimit(ctx.workspace.id, "projects");
    const locale = await getLocale();
    const raw = formToObject(fd);
    const input = projectSchema.parse(raw);
    const templateId = typeof raw.templateId === "string" && isUuid(raw.templateId) ? raw.templateId : null;
    const client = await db.client.findFirst({ where: { id: input.clientId, workspaceId: ctx.workspace.id, archivedAt: null } });
    if (!client) throw new AppError("Choose a client for this project.");
    await assertAssignable(ctx.workspace.id, input.managerId);
    if (input.startDate && input.targetDate && input.targetDate < input.startDate) throw new AppError("Target date must be after the start date.");

    const project = await db.$transaction(async (tx) => {
      const { budget, ...rest } = input;
      const p = await tx.project.create({ data: { ...rest, budgetCents: budget ?? null, managerId: input.managerId ?? ctx.user.id, workspaceId: ctx.workspace.id, status: "ACTIVE" } });
      if (!ctx.isAdmin && !ctx.member.allProjects) await tx.projectMember.create({ data: { projectId: p.id, memberId: ctx.member.id } });
      if (templateId) {
        const tpl = await applyTemplate(tx, ctx.workspace.id, p.id, templateId, locale);
        await logSpec(tx, p.id, ctx, ["Specification created from template “{name}”", { name: tpl.name }]);
      } else await logSpec(tx, p.id, ctx, "Project created");
      await recalcProject(tx, p.id);
      return p;
    });
    await emit({ workspaceId: ctx.workspace.id, type: "PROJECT_CREATED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: client.id, entityType: "PROJECT", entityId: project.id, summary: ["Project “{name}” created", { name: project.name }] });
    return { id: project.id, redirect: `/app/projects/${project.id}` };
  }, "Project created.");
}

export async function updateProjectAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const id = zId.parse(fd.get("id"));
    const { project } = await requireProjectPerm(ctx, id, "projects", "manage");
    const raw = formToObject(fd);
    const input = projectSchema.extend({ status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]) }).parse(raw);
    const client = await db.client.findFirst({ where: { id: input.clientId, workspaceId: ctx.workspace.id } });
    if (!client) throw new AppError("Client not found.");
    await assertAssignable(ctx.workspace.id, input.managerId);
    const { budget, ...rest } = input;
    await db.$transaction(async (tx) => {
      await tx.project.update({ where: { id }, data: { ...rest, budgetCents: budget ?? null, managerId: input.managerId ?? null } });
      if ((project.targetDate?.getTime() ?? 0) !== (input.targetDate?.getTime() ?? 0))
        await logSpec(tx, id, ctx, ["Target date changed from {from} to {to}", { from: project.targetDate ? { date: project.targetDate } : "—", to: input.targetDate ? { date: input.targetDate } : "—" }]);
    });
    if ((project.targetDate?.getTime() ?? 0) !== (input.targetDate?.getTime() ?? 0))
      await emit({ workspaceId: ctx.workspace.id, type: "DEADLINE_CHANGED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: id, clientId: project.clientId, entityType: "PROJECT", entityId: id, summary: ["Target date changed to {date}", { date: input.targetDate ? { date: input.targetDate } : "—" }], clientVisible: true });
    return { id };
  }, "Project saved.");
}

export async function setProgressModeAction(projectId: string, mode: "AUTO" | "MANUAL", manual?: number) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireProjectPerm(ctx, projectId, "projects", "manage");
    const value = mode === "MANUAL" ? z.number().int().min(0).max(100).parse(manual) : null;
    await db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: projectId }, data: { progressMode: mode, manualProgress: value } });
      await recalcProject(tx, projectId);
      await logSpec(tx, projectId, ctx, mode === "MANUAL" ? ["Progress set manually to {n}%", { n: value }] : "Progress switched to automatic");
    });
    return null;
  }, "Progress updated.");
}

export async function completeProjectAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const { project } = await requireProjectPerm(ctx, projectId, "projects", "manage");
    await db.$transaction(async (tx) => {
      await tx.specSnapshot.create({ data: { projectId, reason: "PROJECT_COMPLETED", data: await snapshotSpec(tx, projectId) } });
      await tx.project.update({ where: { id: projectId }, data: { status: "COMPLETED", completedAt: new Date() } });
      await logSpec(tx, projectId, ctx, "Project marked complete");
    });
    await emit({
      workspaceId: ctx.workspace.id, type: "PROJECT_COMPLETED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId, clientId: project.clientId, entityType: "PROJECT", entityId: projectId,
      summary: ["Project “{name}” completed", { name: project.name }], clientVisible: true,
      notify: { team: { kind: "project" }, client: true, title: ["{name} is complete", { name: project.name }], message: "The project has been marked as completed. Documents and invoices remain available in your portal.", actionUrl: `/app/projects/${projectId}`, clientActionUrl: `/portal/projects/${projectId}`, actionLabel: "Open project", email: true },
    });
    return null;
  }, "Project marked complete.");
}

export async function reopenProjectAction(projectId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await requireProjectPerm(ctx, projectId, "projects", "manage");
    await db.project.update({ where: { id: projectId }, data: { status: "ACTIVE", completedAt: null } });
    return null;
  }, "Project reopened.");
}

export async function archiveProjectAction(projectId: string, archive: boolean) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const { project } = await requireProjectPerm(ctx, projectId, "projects", "manage");
    if (!archive) await assertWithinLimit(ctx.workspace.id, "projects");
    await db.project.update({ where: { id: projectId }, data: { archivedAt: archive ? new Date() : null } });
    if (archive) await emit({ workspaceId: ctx.workspace.id, type: "PROJECT_ARCHIVED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId, clientId: project.clientId, entityType: "PROJECT", entityId: projectId, summary: ["Project “{name}” archived", { name: project.name }] });
    return { redirect: archive ? "/app/projects" : `/app/projects/${projectId}` };
  }, archive ? "Project archived." : "Project restored.");
}

export async function saveProjectAsTemplateAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "projects", "manage");
    const i = z.object({ projectId: zId, name: z.string().trim().min(1).max(100), category: z.string().trim().max(60).default("Custom") }).parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "view");
    const phases = await db.phase.findMany({ where: { projectId: i.projectId }, orderBy: { position: "asc" }, include: { tasks: { where: { parentId: null }, orderBy: { position: "asc" } } } });
    const tpl = await db.projectTemplate.create({
      data: {
        workspaceId: ctx.workspace.id, name: i.name, category: i.category,
        phases: { create: phases.map((p, idx) => ({ title: p.title, weight: p.weight, position: idx, tasks: { create: p.tasks.map((t, j) => ({ title: t.title, description: t.description, weight: t.weight, position: j, visibility: t.visibility, requiresApproval: t.requiresApproval })) } })) },
      },
    });
    return { id: tpl.id };
  }, "Template saved.");
}

// ───────── Project updates, waits, scope changes, links, events ─────────

export async function publishProjectUpdateAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, title: zOptStr(160), body: z.string().trim().min(1, "Write an update.").max(10000), nextSteps: zOptStr(4000), notify: z.string().optional() }).parse(formToObject(fd));
    const { project } = await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    await requireActiveSubscription(ctx.workspace.id);
    const u = await db.projectUpdate.create({ data: { projectId: i.projectId, title: i.title, body: i.body, nextSteps: i.nextSteps, authorId: ctx.user.id, authorName: ctx.user.name } });
    await emit({
      workspaceId: ctx.workspace.id, type: "PROJECT_UPDATE_PUBLISHED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: project.clientId, entityType: "PROJECT_UPDATE", entityId: u.id,
      summary: i.title ? ["Update published: {title}", { title: i.title }] : "Update published", clientVisible: true,
      notify: { client: true, title: i.title ? `${project.name}: ${i.title}` : ["New update on {project}", { project: project.name }], message: i.nextSteps ? ["{body}\n\nNext: {next}", { body: i.body.slice(0, 600), next: i.nextSteps.slice(0, 300) }] : i.body.slice(0, 600), clientActionUrl: `/portal/projects/${project.id}`, actionLabel: "View project", email: Boolean(i.notify) },
    });
    return null;
  }, "Update published.");
}

export async function deleteProjectUpdateAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const u = await db.projectUpdate.findFirst({ where: { id, project: { workspaceId: ctx.workspace.id } } });
    if (!u) throw notFound();
    await requireProjectPerm(ctx, u.projectId, "projects", "edit");
    await db.projectUpdate.delete({ where: { id } });
    return null;
  }, "Update deleted.");
}

export async function startClientWaitAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, reason: z.enum(["APPROVAL", "DOCUMENT", "INFORMATION", "PAYMENT", "OTHER"]), label: z.string().trim().min(1, "Describe what you need.").max(200) }).parse(formToObject(fd));
    const { project } = await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    const w = await db.clientWait.create({ data: { projectId: i.projectId, reason: i.reason, label: i.label } });
    await emit({
      workspaceId: ctx.workspace.id, type: "CLIENT_WAIT_STARTED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: project.clientId, entityType: "CLIENT_WAIT", entityId: w.id,
      summary: ["Waiting for client: {label}", { label: i.label }], clientVisible: true,
      notify: { client: true, title: ["{project}: your input is needed", { project: project.name }], message: ["{label}", { label: i.label }], clientActionUrl: `/portal/projects/${project.id}`, actionLabel: "Open portal", email: true },
    });
    return null;
  }, "Client request recorded.");
}

export async function resolveClientWaitAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const w = await db.clientWait.findFirst({ where: { id, project: { workspaceId: ctx.workspace.id } } });
    if (!w) throw notFound();
    await requireProjectPerm(ctx, w.projectId, "projects", "edit");
    await db.clientWait.update({ where: { id }, data: { resolvedAt: new Date() } });
    return null;
  }, "Marked as received.");
}

export async function createScopeChangeAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, description: z.string().trim().min(1).max(4000), requestedBy: z.string().trim().min(1).max(120), additionalCost: zOptMoney, additionalDays: z.coerce.number().int().min(0).max(3650).default(0) }).parse(formToObject(fd));
    const { project } = await requireProjectPerm(ctx, i.projectId, "projects", "manage");
    await db.$transaction(async (tx) => {
      await tx.scopeChange.create({ data: { projectId: i.projectId, description: i.description, requestedBy: i.requestedBy, additionalCostCents: i.additionalCost ?? 0, additionalDays: i.additionalDays } });
      await logSpec(tx, i.projectId, ctx, ["Scope change proposed: {text}", { text: i.description.slice(0, 120) }]);
    });
    await emit({ workspaceId: ctx.workspace.id, type: "SCOPE_CHANGE", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: project.clientId, entityType: "PROJECT", entityId: project.id, summary: "Scope change proposed" });
    return null;
  }, "Scope change recorded.");
}

export async function decideScopeChangeAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ id: zId, decision: z.enum(["APPROVED", "REJECTED"]), createTask: z.string().optional(), extendDeadline: z.string().optional() }).parse(formToObject(fd));
    const sc = await db.scopeChange.findFirst({ where: { id: i.id, project: { workspaceId: ctx.workspace.id } }, include: { project: true } });
    if (!sc) throw notFound();
    await requireProjectPerm(ctx, sc.projectId, "projects", "manage");
    if (sc.status !== "PROPOSED") throw new AppError("This scope change was already decided.");
    await db.$transaction(async (tx) => {
      await tx.scopeChange.update({ where: { id: sc.id }, data: { status: i.decision, decidedAt: new Date() } });
      if (i.decision === "APPROVED") {
        if (i.createTask) await tx.task.create({ data: { workspaceId: ctx.workspace.id, projectId: sc.projectId, title: sc.description.slice(0, 140), description: sc.description, costCents: sc.additionalCostCents || null } });
        if (i.extendDeadline && sc.additionalDays > 0 && sc.project.targetDate)
          await tx.project.update({ where: { id: sc.projectId }, data: { targetDate: new Date(sc.project.targetDate.getTime() + sc.additionalDays * 86400_000) } });
        await recalcProject(tx, sc.projectId);
      }
      await logSpec(tx, sc.projectId, ctx, [i.decision === "APPROVED" ? "Scope change accepted: {text}" : "Scope change rejected: {text}", { text: sc.description.slice(0, 120) }]);
    });
    return null;
  }, "Scope change updated.");
}

export async function addCalendarEventAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ title: z.string().trim().min(1).max(160), startsAt: z.coerce.date(), endsAt: zOptDate, location: zOptStr(200), projectId: zOptId }).parse(formToObject(fd));
    if (i.projectId) await requireProjectPerm(ctx, i.projectId, "projects", "view");
    await db.calendarEvent.create({ data: { ...i, projectId: i.projectId ?? null, workspaceId: ctx.workspace.id, createdById: ctx.user.id } });
    return null;
  }, "Meeting added.");
}

export async function deleteCalendarEventAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const e = await db.calendarEvent.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
    if (!e) throw notFound();
    if (e.createdById !== ctx.user.id && !ctx.isAdmin) throw new AppError("Only the organiser can delete this meeting.", "FORBIDDEN");
    await db.calendarEvent.delete({ where: { id } });
    return null;
  }, "Meeting deleted.");
}
