"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, notFound, AppError } from "@/lib/errors";
import { requireWorkspace, requireProjectPerm, isUuid } from "@/lib/auth/context";
import { formToObject, zId, zUrl, zBool } from "@/lib/validation";
import { inspectUrl } from "@/server/services/previews";
import { rateLimit } from "@/lib/rate-limit";

export async function addPreviewAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await rateLimit("preview", 60, 3600, ctx.workspace.id);
    const i = z.object({ projectId: zId, label: z.string().trim().min(1).max(120), url: zUrl, type: z.enum(["WEBSITE", "MOBILE_APP", "PROTOTYPE", "EXTERNAL", "OTHER"]), internal: zBool }).parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    const count = await db.preview.count({ where: { projectId: i.projectId } });
    if (count >= 30) throw new AppError("Preview limit reached for this project.");
    const meta = await inspectUrl(i.url);
    await db.preview.create({ data: { projectId: i.projectId, label: i.label, url: i.url, type: i.type, visibility: i.internal ? "INTERNAL" : "CLIENT_VISIBLE", ...meta, checkedAt: new Date() } });
    return null;
  }, "Preview added.");
}

export async function refreshPreviewAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    if (!isUuid(id)) throw notFound();
    const p = await db.preview.findFirst({ where: { id, project: { workspaceId: ctx.workspace.id } } });
    if (!p) throw notFound();
    await requireProjectPerm(ctx, p.projectId, "projects", "edit");
    await rateLimit("preview-refresh", 20, 3600, ctx.workspace.id);
    await db.preview.update({ where: { id }, data: { ...(await inspectUrl(p.url)), checkedAt: new Date() } });
    return null;
  }, "Preview refreshed.");
}

export async function deletePreviewAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    if (!isUuid(id)) throw notFound();
    const p = await db.preview.findFirst({ where: { id, project: { workspaceId: ctx.workspace.id } } });
    if (!p) throw notFound();
    await requireProjectPerm(ctx, p.projectId, "projects", "edit");
    await db.preview.delete({ where: { id } });
    return null;
  }, "Preview removed.");
}

export async function addLinkAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, label: z.string().trim().min(1).max(120), url: zUrl, internal: zBool }).parse(formToObject(fd));
    await requireProjectPerm(ctx, i.projectId, "projects", "edit");
    await db.projectLink.create({ data: { projectId: i.projectId, label: i.label, url: i.url, visibility: i.internal ? "INTERNAL" : "CLIENT_VISIBLE" } });
    return null;
  }, "Link added.");
}

export async function deleteLinkAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    if (!isUuid(id)) throw notFound();
    const l = await db.projectLink.findFirst({ where: { id, project: { workspaceId: ctx.workspace.id } } });
    if (!l) throw notFound();
    await requireProjectPerm(ctx, l.projectId, "projects", "edit");
    await db.projectLink.delete({ where: { id } });
    return null;
  }, "Link removed.");
}
