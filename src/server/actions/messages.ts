"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, notFound, AppError } from "@/lib/errors";
import { requireWorkspace, requireProjectPerm } from "@/lib/auth/context";
import { formToObject, zId } from "@/lib/validation";
import { emit } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";

const ENTITY = z.enum(["PROJECT", "TASK", "DELIVERABLE", "FILE", "INVOICE"]);

/** Verifies the contextual entity really belongs to the project (prevents cross-linking foreign ids). */
async function assertEntity(projectId: string, type: z.infer<typeof ENTITY>, id: string) {
  const ok =
    type === "PROJECT" ? id === projectId :
    type === "TASK" ? await db.task.findFirst({ where: { id, projectId } }) :
    type === "DELIVERABLE" ? await db.deliverable.findFirst({ where: { id, projectId } }) :
    type === "FILE" ? await db.file.findFirst({ where: { id, projectId } }) :
    await db.invoice.findFirst({ where: { id, projectId } });
  if (!ok) throw notFound("Conversation not found.");
}

export async function postMessageAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await rateLimit("message", 120, 3600, ctx.user.id);
    const i = z
      .object({ projectId: zId, entityType: ENTITY.default("PROJECT"), entityId: z.string().optional(), body: z.string().trim().min(1, "Write a message.").max(10000), visibility: z.enum(["INTERNAL", "CLIENT_VISIBLE"]) })
      .parse(formToObject(fd));
    const { project } = await requireProjectPerm(ctx, i.projectId, "messages", i.visibility === "CLIENT_VISIBLE" ? "send" : "view");
    const entityId = i.entityId || i.projectId;
    await assertEntity(i.projectId, i.entityType, entityId);
    if (i.entityType === "TASK" && i.visibility === "CLIENT_VISIBLE") {
      const t = await db.task.findUnique({ where: { id: entityId } });
      if (t?.visibility === "INTERNAL") throw new AppError("This task is internal — messages on it can't be visible to the client.");
    }
    const msg = await db.message.create({ data: { workspaceId: ctx.workspace.id, projectId: i.projectId, entityType: i.entityType, entityId, visibility: i.visibility, body: i.body, authorId: ctx.user.id, authorName: ctx.user.name } });
    const actor = { id: ctx.user.id, name: ctx.user.name };
    const excerpt = i.body.length > 280 ? `${i.body.slice(0, 280)}…` : i.body;

    // @mentions of team members (by first name or full name).
    const mentions = [...i.body.matchAll(/@([\p{L}][\p{L}.-]{1,40})/gu)].map((m) => m[1].toLowerCase());
    if (mentions.length) {
      const members = await db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } });
      const hit = members.filter((m) => mentions.some((x) => m.user.name.toLowerCase().split(" ")[0] === x || m.user.name.toLowerCase().replace(/\s+/g, ".") === x)).map((m) => m.user.id);
      if (hit.length)
        await emit({ workspaceId: ctx.workspace.id, type: "MENTION_RECEIVED", actor, projectId: project.id, entityType: "MESSAGE", entityId: msg.id, summary: "Mentioned a teammate", notify: { team: { kind: "users", userIds: hit }, title: ["{user} mentioned you", { user: ctx.user.name }], message: excerpt, actionUrl: `/app/projects/${project.id}/messages`, actionLabel: "Open conversation", email: true } });
    }
    await emit({
      workspaceId: ctx.workspace.id, type: "MESSAGE_POSTED", actor, projectId: project.id, clientId: project.clientId, entityType: "MESSAGE", entityId: msg.id,
      summary: i.visibility === "CLIENT_VISIBLE" ? "Sent a message to the client" : "Added an internal note", clientVisible: i.visibility === "CLIENT_VISIBLE",
      notify: i.visibility === "CLIENT_VISIBLE"
        ? { client: true, title: ["New message — {project}", { project: project.name }], message: `${ctx.user.name}: ${excerpt}`, clientActionUrl: `/portal/projects/${project.id}/messages`, actionLabel: "Reply", email: true }
        : undefined,
    });
    return null;
  });
}
