"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { requireWorkspace, requireProjectPerm } from "@/lib/auth/context";
import { formToObject, zId } from "@/lib/validation";
import { emit } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";
import { CHANGE_SUBJECTS, CHANGE_REQUEST_STATUS, type ChangeSubject } from "@/lib/labels";
import { logSpec } from "@/server/services/spec";
import { recalcProject } from "@/lib/progress";

const SUBJECT = z.enum(Object.keys(CHANGE_SUBJECTS) as [ChangeSubject, ...ChangeSubject[]]);

/**
 * Client → professional: a change request with a subject, the concerned page and detailed feedback.
 * The people managing the project and its specification are notified in-app and by email.
 */
export async function createChangeRequestAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePortal();
    await rateLimit("change-request", 30, 3600, ctx.user.id);
    const i = z
      .object({
        projectId: zId,
        subject: SUBJECT,
        page: z.string().trim().max(160).optional(),
        pageOther: z.string().trim().max(160).optional(),
        message: z.string().trim().min(1, "Describe what you need.").max(5000),
      })
      .parse(formToObject(fd));
    const project = await getPortalProject(ctx, i.projectId);
    const page = (i.page === "__other" ? i.pageOther : i.page) || null;
    const cr = await db.changeRequest.create({
      data: { workspaceId: ctx.workspace.id, projectId: project.id, clientId: ctx.client.id, authorId: ctx.user.id, authorName: ctx.user.name, subject: i.subject, page, message: i.message },
    });
    const subject = { t: CHANGE_SUBJECTS[i.subject] };
    await emit({
      workspaceId: ctx.workspace.id, type: "CLIENT_CHANGE_REQUEST", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: ctx.client.id, entityType: "CHANGE_REQUEST", entityId: cr.id,
      summary: page ? ["Change request: {subject} — {page}", { subject, page }] : ["Change request: {subject}", { subject }], clientVisible: true,
      notify: {
        team: { kind: "project", capability: ["projects", "edit"] },
        title: ["{user} requested a change on {project}", { user: ctx.user.name, project: project.name }],
        message: page ? ["{subject} — {page}\n\n{message}", { subject, page, message: i.message.slice(0, 1500) }] : ["{subject}\n\n{message}", { subject, message: i.message.slice(0, 1500) }],
        actionUrl: `/app/projects/${project.id}/requests#${cr.id}`, actionLabel: "Open request", email: true,
      },
    });
    return { id: cr.id };
  }, "Your request was sent. The team has been notified.");
}

/** Professional side: move a request through its lifecycle, answer the client, optionally turn it into a task. */
export async function updateChangeRequestAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z
      .object({ id: zId, status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "DECLINED"]), response: z.string().trim().max(5000).optional(), createTask: z.string().optional() })
      .parse(formToObject(fd));
    const cr = await db.changeRequest.findFirst({ where: { id: i.id, workspaceId: ctx.workspace.id }, include: { project: true } });
    if (!cr) throw notFound();
    await requireProjectPerm(ctx, cr.projectId, "projects", "edit");
    const response = i.response || null;
    const changed = cr.status !== i.status || (response ?? null) !== (cr.response ?? null);
    if (!changed && !i.createTask) throw new AppError("Nothing to update.");
    await db.$transaction(async (tx) => {
      let taskId = cr.taskId;
      if (i.createTask && !taskId) {
        const title = `${cr.page ? `${cr.page} — ` : ""}${cr.message.split("\n")[0]!}`.slice(0, 200);
        const last = await tx.task.aggregate({ where: { projectId: cr.projectId, phaseId: null, parentId: null }, _max: { position: true } });
        const task = await tx.task.create({ data: { workspaceId: ctx.workspace.id, projectId: cr.projectId, title, description: cr.message, visibility: "CLIENT_VISIBLE", position: (last._max.position ?? -1) + 1 } });
        taskId = task.id;
        await logSpec(tx, cr.projectId, ctx, ["Task “{name}” added", { name: title }]);
        await recalcProject(tx, cr.projectId);
      }
      await tx.changeRequest.update({
        where: { id: cr.id },
        data: { status: i.status, response, taskId, ...(changed ? { respondedById: ctx.user.id, respondedAt: new Date() } : {}) },
      });
    });
    if (changed)
      await emit({
        workspaceId: ctx.workspace.id, type: "CHANGE_REQUEST_UPDATED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: cr.projectId, clientId: cr.clientId, entityType: "CHANGE_REQUEST", entityId: cr.id,
        summary: ["Change request marked {status}", { status: { t: CHANGE_REQUEST_STATUS[i.status].label } }], clientVisible: true,
        notify: {
          client: true,
          title: ["Your change request: {status}", { status: { t: CHANGE_REQUEST_STATUS[i.status].label } }],
          message: response ? ["{message}\n\n{response}", { message: cr.message.slice(0, 300), response }] : cr.message.slice(0, 300),
          clientActionUrl: `/portal/projects/${cr.projectId}/requests#${cr.id}`, actionLabel: "View request", email: Boolean(response) || i.status === "DONE",
        },
      });
    return null;
  }, "Request updated.");
}

/** The list of pages/screens the client can pick in a change request. */
export async function saveProjectPagesAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, pages: z.string().max(5000).default("") }).parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    const pages = [...new Set(i.pages.split(/\r?\n/).map((p) => p.trim()).filter(Boolean))].slice(0, 60).map((p) => p.slice(0, 160));
    await db.project.update({ where: { id: i.projectId }, data: { pages } });
    return null;
  }, "Pages saved.");
}
