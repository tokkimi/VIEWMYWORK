"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, notFound, AppError } from "@/lib/errors";
import { requireWorkspace, requirePerm, isUuid } from "@/lib/auth/context";

const phaseSchema = z.object({ title: z.string().trim().min(1).max(140), weight: z.coerce.number().int().min(0).max(1000), tasks: z.array(z.string().trim().min(1).max(200)).max(100) });
const tplSchema = z.object({ name: z.string().trim().min(1, "Name is required.").max(100), category: z.string().trim().max(60).default("Custom"), description: z.string().trim().max(500).optional(), phases: z.array(phaseSchema).min(1, "Add at least one phase.").max(30) });

export async function saveTemplateAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "projects", "manage");
    const raw = JSON.parse(String(fd.get("payload") ?? "{}"));
    const i = tplSchema.parse(raw);
    const id = typeof raw.id === "string" && isUuid(raw.id) ? raw.id : null;
    const phases = { create: i.phases.map((p, idx) => ({ title: p.title, weight: p.weight, position: idx, tasks: { create: p.tasks.map((t, j) => ({ title: t, position: j })) } })) };
    if (id) {
      const t = await db.projectTemplate.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
      if (!t) throw new AppError("Built-in templates can't be edited — duplicate one instead.", "FORBIDDEN");
      await db.$transaction([db.templatePhase.deleteMany({ where: { templateId: id } }), db.projectTemplate.update({ where: { id }, data: { name: i.name, category: i.category, description: i.description, phases } })]);
      return { id };
    }
    const t = await db.projectTemplate.create({ data: { workspaceId: ctx.workspace.id, name: i.name, category: i.category, description: i.description, phases } });
    return { id: t.id };
  }, "Template saved.");
}

export async function duplicateTemplateAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "projects", "manage");
    const t = await db.projectTemplate.findFirst({ where: { id, OR: [{ workspaceId: null }, { workspaceId: ctx.workspace.id }] }, include: { phases: { include: { tasks: true } } } });
    if (!t) throw notFound();
    await db.projectTemplate.create({
      data: { workspaceId: ctx.workspace.id, name: `${t.name} (copy)`, category: t.category, description: t.description, phases: { create: t.phases.map((p) => ({ title: p.title, weight: p.weight, position: p.position, tasks: { create: p.tasks.map((x) => ({ title: x.title, description: x.description, weight: x.weight, position: x.position, visibility: x.visibility, requiresApproval: x.requiresApproval })) } })) } },
    });
    return null;
  }, "Template duplicated.");
}

export async function deleteTemplateAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "projects", "manage");
    const r = await db.projectTemplate.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
    if (!r.count) throw new AppError("Built-in templates can't be deleted.", "FORBIDDEN");
    return null;
  }, "Template deleted.");
}
