"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireSuperAdmin, isUuid } from "@/lib/auth/context";
import { formToObject, zOptStr, zCurrency } from "@/lib/validation";
import { parseMoneyToCents } from "@/lib/money";
import { FEATURE_KEYS } from "@/lib/plans";
import { integrations } from "@/lib/env";
import { syncPlanToStripe } from "@/server/services/subscriptions";

async function audit(actor: { id: string; email: string }, action: string, targetType: string, targetId: string, metadata?: Prisma.InputJsonValue) {
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  await db.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, scope: "PLATFORM", action, targetType, targetId, metadata, ip } });
}

const optInt = z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().min(0).nullable());
const money = z.preprocess((v) => parseMoneyToCents(v as string), z.number().int().min(0));
const optMoney = z.preprocess((v) => (v === "" || v === undefined ? null : parseMoneyToCents(v as string)), z.number().int().min(0).nullable());

/** Creates or updates a Plan. Price edits never change existing subscriptions (their price is snapshotted). */
export async function savePlanAction(fd: FormData) {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    const raw = formToObject(fd);
    const i = z
      .object({
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/, "Code: 2–30 letters, digits or _."),
        name: z.string().trim().min(1).max(60),
        description: zOptStr(300),
        monthlyPrice: money,
        annualPrice: optMoney,
        currency: zCurrency,
        storageLimitMb: optInt,
        activeProjectLimit: optInt,
        clientLimit: optInt,
        collaboratorLimit: optInt,
        trialDays: z.coerce.number().int().min(0).max(365),
        sortOrder: z.coerce.number().int().min(0).max(1000),
        isActive: z.preprocess((v) => v === "on", z.boolean()),
        isPublic: z.preprocess((v) => v === "on", z.boolean()),
        highlight: z.preprocess((v) => v === "on", z.boolean()),
      })
      .parse(raw);
    const features = Object.keys(FEATURE_KEYS).map((key) => ({ key, enabled: fd.get(`feature_${key}`) === "on" }));
    const data = { code: i.code, name: i.name, description: i.description ?? null, monthlyPriceCents: i.monthlyPrice, annualPriceCents: i.annualPrice, currency: i.currency, storageLimitMb: i.storageLimitMb, activeProjectLimit: i.activeProjectLimit, clientLimit: i.clientLimit, collaboratorLimit: i.collaboratorLimit, trialDays: i.trialDays, sortOrder: i.sortOrder, isActive: i.isActive, isPublic: i.isPublic, highlight: i.highlight };
    const id = typeof raw.id === "string" && isUuid(raw.id) ? raw.id : null;
    const plan = await db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.plan.findUnique({ where: { id } });
        if (!before) throw notFound();
        if (before.code !== i.code && (await tx.plan.findUnique({ where: { code: i.code } }))) throw new AppError("Another plan uses this code.", "CONFLICT");
        const p = await tx.plan.update({ where: { id }, data });
        for (const f of features) await tx.planFeature.upsert({ where: { planId_key: { planId: id, key: f.key } }, create: { planId: id, ...f }, update: { enabled: f.enabled } });
        return { p, before };
      }
      if (await tx.plan.findUnique({ where: { code: i.code } })) throw new AppError("A plan with this code already exists.", "CONFLICT");
      const p = await tx.plan.create({ data: { ...data, features: { create: features } } });
      return { p, before: null };
    });
    await audit(admin, id ? "PLAN_UPDATED" : "PLAN_CREATED", "PLAN", plan.p.id, { before: plan.before ? { monthly: plan.before.monthlyPriceCents, annual: plan.before.annualPriceCents } : null, after: { monthly: i.monthlyPrice, annual: i.annualPrice }, features });
    // Keep Stripe prices in sync when configured (creates new Prices; old ones stay for existing subscribers).
    if (integrations.stripe() && plan.p.stripeProductId && (plan.before?.monthlyPriceCents !== i.monthlyPrice || plan.before?.annualPriceCents !== i.annualPrice || plan.before?.currency !== i.currency)) {
      await syncPlanToStripe(plan.p.id).catch((e) => console.error("[admin] stripe sync", e));
    }
    return { id: plan.p.id };
  }, "Plan saved.");
}

export async function syncPlanStripeAction(planId: string) {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    if (!integrations.stripe()) throw new AppError("Stripe isn't configured.", "CONFIG");
    await syncPlanToStripe(planId);
    await audit(admin, "PLAN_STRIPE_SYNCED", "PLAN", planId);
    return null;
  }, "Stripe prices synced.");
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    if (!isUuid(userId)) throw notFound();
    if (userId === admin.id) throw new AppError("You can't suspend yourself.");
    const u = await db.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
    await audit(admin, status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED", "USER", userId, { email: u.email });
    return null;
  }, status === "SUSPENDED" ? "User suspended." : "User reactivated.");
}

export async function setPlatformRoleAction(userId: string, role: "USER" | "SUPER_ADMIN") {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    if (!isUuid(userId)) throw notFound();
    if (userId === admin.id && role === "USER") throw new AppError("You can't remove your own admin access.");
    const u = await db.user.update({ where: { id: userId }, data: { platformRole: role } });
    await audit(admin, "PLATFORM_ROLE_CHANGED", "USER", userId, { email: u.email, role });
    return null;
  }, "Access updated.");
}

/** Changes a workspace's plan (support action). Price snapshot is updated to the plan's current price. */
export async function changeWorkspacePlanAction(fd: FormData) {
  return runAction(async () => {
    const admin = await requireSuperAdmin();
    const i = z.object({ workspaceId: z.string().uuid(), planId: z.string().uuid(), status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"]), trialEndsAt: z.preprocess((v) => (v ? v : undefined), z.coerce.date().optional()) }).parse(formToObject(fd));
    const plan = await db.plan.findUnique({ where: { id: i.planId } });
    if (!plan) throw notFound("Plan not found.");
    const before = await db.subscription.findUnique({ where: { workspaceId: i.workspaceId } });
    if (!before) throw notFound("Subscription not found.");
    if (before.stripeSubscriptionId && before.planId !== plan.id) throw new AppError("This workspace pays through Stripe — change the plan from Stripe or ask the owner to switch plans.", "CONFLICT");
    await db.subscription.update({ where: { workspaceId: i.workspaceId }, data: { planId: plan.id, status: i.status, trialEndsAt: i.trialEndsAt ?? before.trialEndsAt, ...(before.planId !== plan.id ? { priceCents: plan.monthlyPriceCents, currency: plan.currency } : {}) } });
    await audit(admin, "WORKSPACE_PLAN_CHANGED", "WORKSPACE", i.workspaceId, { from: before.planId, to: plan.id, status: i.status });
    return null;
  }, "Subscription updated.");
}
