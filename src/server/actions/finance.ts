"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, notFound } from "@/lib/errors";
import { requireWorkspace, requirePerm, requireProjectPerm, isUuid } from "@/lib/auth/context";
import { formToObject, zOptStr, zCurrency, zMoney, zOptMoney } from "@/lib/validation";
import { emit } from "@/lib/events";


const expenseSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  category: z.enum(["SOFTWARE", "FREELANCER", "TRAVEL", "MATERIAL", "ADVERTISING", "OTHER"]),
  amount: zMoney.refine((v) => v > 0, "Amount must be greater than zero."),
  tax: zOptMoney,
  currency: zCurrency,
  date: z.coerce.date(),
  supplier: zOptStr(160),
  reference: zOptStr(120),
  notes: zOptStr(2000),
  projectId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
});

export async function saveExpenseAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "finance", "edit");
    const raw = formToObject(fd);
    const i = expenseSchema.parse(raw);
    if (i.projectId) await requireProjectPerm(ctx, i.projectId, "projects", "view");
    const { amount, tax, ...rest } = i;
    const data = { ...rest, amountCents: amount, taxCents: tax ?? 0, projectId: i.projectId ?? null };
    const id = typeof raw.id === "string" && isUuid(raw.id) ? raw.id : null;
    if (id) {
      const e = await db.expense.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
      if (!e) throw notFound();
      await db.expense.update({ where: { id }, data });
      return { id };
    }
    const e = await db.expense.create({ data: { ...data, workspaceId: ctx.workspace.id, createdById: ctx.user.id } });
    await emit({ workspaceId: ctx.workspace.id, type: "EXPENSE_CREATED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: e.projectId, entityType: "EXPENSE", entityId: e.id, summary: ["Expense “{name}” ({amount}) recorded", { name: e.name, amount: { money: e.amountCents, currency: e.currency } }] });
    return { id: e.id };
  }, "Expense saved.");
}

export async function deleteExpenseAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "finance", "edit");
    const e = await db.expense.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
    if (!e) throw notFound();
    await db.expense.delete({ where: { id } });
    await db.auditLog.create({ data: { actorId: ctx.user.id, actorEmail: ctx.user.email, scope: "WORKSPACE", workspaceId: ctx.workspace.id, action: "EXPENSE_DELETED", targetType: "EXPENSE", targetId: id, metadata: { name: e.name, amountCents: e.amountCents } } });
    return null;
  }, "Expense deleted.");
}
