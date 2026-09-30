"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { requireVerifiedUser, requireWorkspace, requirePerm, WORKSPACE_COOKIE, isUuid } from "@/lib/auth/context";
import { formToObject, zOptStr, zCurrency } from "@/lib/validation";
import { slugify } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { PORTAL_COOKIE } from "@/lib/auth/portal";
import { requireFeature } from "@/lib/plans";

export async function createWorkspaceAction(fd: FormData) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    await rateLimit("create-workspace", 5, 3600, user.id);
    const input = z
      .object({ name: z.string().trim().min(2, "Enter your workspace name.").max(80), industry: zOptStr(80), plan: z.string().trim().max(40).optional(), currency: zCurrency.default("EUR") })
      .parse(formToObject(fd));
    const owned = await db.workspaceMember.count({ where: { userId: user.id, role: "OWNER" } });
    if (owned >= 5) throw new AppError("You already own the maximum number of workspaces.", "LIMIT");

    const plan =
      (input.plan && (await db.plan.findFirst({ where: { code: input.plan, isActive: true } }))) ||
      (await db.plan.findFirst({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } }));
    if (!plan) throw new AppError("No plan is available yet. Please contact support.", "CONFIG");

    const base = slugify(input.name);
    const slug = (await db.workspace.findUnique({ where: { slug: base } })) ? `${base}-${Math.random().toString(36).slice(2, 7)}` : base;

    const ws = await db.$transaction(async (tx) => {
      const ws = await tx.workspace.create({ data: { name: input.name, slug, industry: input.industry, defaultCurrency: input.currency, timezone: user.timezone } });
      await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER", allProjects: true } });
      await tx.invoiceSettings.create({ data: { workspaceId: ws.id, defaultCurrency: input.currency } });
      await tx.workspaceSetting.create({ data: { workspaceId: ws.id, companyLegalName: input.name, companyEmail: user.email } });
      await tx.subscription.create({
        data: {
          workspaceId: ws.id,
          planId: plan.id,
          status: plan.trialDays > 0 ? "TRIALING" : "INCOMPLETE",
          priceCents: plan.monthlyPriceCents, // snapshot: later price edits never affect this subscription
          currency: plan.currency,
          trialEndsAt: plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 86400_000) : null,
        },
      });
      return ws;
    });
    (await cookies()).set(WORKSPACE_COOKIE, ws.id, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/" });
    return { redirect: "/onboarding?step=client" };
  });
}

export async function finishOnboardingAction() {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    await db.workspace.update({ where: { id: ctx.workspace.id }, data: { onboardingDone: true } });
    return { redirect: "/app" };
  });
}

export async function switchWorkspaceAction(workspaceId: string) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    if (!isUuid(workspaceId)) throw new AppError("Invalid workspace.");
    const m = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
    if (!m || m.status !== "ACTIVE") throw new AppError("Workspace not found.", "NOT_FOUND");
    (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/" });
    return { redirect: "/app" };
  });
}

export async function switchPortalClientAction(clientId: string) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    if (!isUuid(clientId)) throw new AppError("Invalid portal.");
    const a = await db.clientPortalAccess.findUnique({ where: { clientId_userId: { clientId, userId: user.id } } });
    if (!a || a.revokedAt) throw new AppError("Portal not found.", "NOT_FOUND");
    (await cookies()).set(PORTAL_COOKIE, clientId, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/" });
    return { redirect: "/portal" };
  });
}

export async function updateWorkspaceGeneralAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const i = z
      .object({
        name: z.string().trim().min(2).max(80),
        industry: zOptStr(80),
        defaultCurrency: zCurrency,
        timezone: z.string().trim().max(64),
        locale: z.string().trim().max(10),
        companyLegalName: zOptStr(160),
        companyAddress: zOptStr(500),
        companyEmail: zOptStr(254),
        companyPhone: zOptStr(40),
        companyVatNumber: zOptStr(40),
        companyRegistration: zOptStr(60),
        companyCountry: zOptStr(60),
      })
      .parse(formToObject(fd));
    const { name, industry, defaultCurrency, timezone, locale, ...company } = i;
    await db.$transaction([
      db.workspace.update({ where: { id: ctx.workspace.id }, data: { name, industry, defaultCurrency, timezone, locale } }),
      db.workspaceSetting.upsert({ where: { workspaceId: ctx.workspace.id }, create: { workspaceId: ctx.workspace.id, ...company }, update: company }),
    ]);
    return null;
  }, "Workspace settings saved.");
}

export async function updateBrandingAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const i = z.object({ logoUrl: zOptStr(2000), portalLogoUrl: zOptStr(2000), invoiceLogoUrl: zOptStr(2000) }).parse(formToObject(fd));
    for (const u of Object.values(i)) if (u && !/^https:\/\//.test(u) && !u.startsWith("/api/public/logo/")) throw new AppError("Logo URLs must use https.");
    if (i.portalLogoUrl || i.invoiceLogoUrl) await requireFeature(ctx.workspace.id, "custom_branding");
    await db.$transaction([
      db.workspace.update({ where: { id: ctx.workspace.id }, data: { logoUrl: i.logoUrl ?? null } }),
      db.workspaceSetting.upsert({
        where: { workspaceId: ctx.workspace.id },
        create: { workspaceId: ctx.workspace.id, portalLogoUrl: i.portalLogoUrl ?? null, invoiceLogoUrl: i.invoiceLogoUrl ?? null },
        update: { portalLogoUrl: i.portalLogoUrl ?? null, invoiceLogoUrl: i.invoiceLogoUrl ?? null },
      }),
    ]);
    return null;
  }, "Branding saved.");
}
