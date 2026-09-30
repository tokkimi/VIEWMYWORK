"use server";

import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { requireFeature } from "@/lib/plans";

/** Starts/continues Stripe Connect (Express) onboarding so the professional receives client payments directly. */
export async function connectStripeAction() {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    await requireFeature(ctx.workspace.id, "online_payments");
    const stripe = getStripe();
    let acct = await db.paymentAccount.findUnique({ where: { workspaceId: ctx.workspace.id } });
    if (!acct) {
      const settings = await db.workspaceSetting.findUnique({ where: { workspaceId: ctx.workspace.id } });
      const a = await stripe.accounts.create({
        type: "express",
        email: settings?.companyEmail ?? ctx.user.email,
        business_profile: { name: ctx.workspace.name },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { workspaceId: ctx.workspace.id },
      });
      acct = await db.paymentAccount.create({ data: { workspaceId: ctx.workspace.id, stripeAccountId: a.id } });
      await db.auditLog.create({ data: { actorId: ctx.user.id, actorEmail: ctx.user.email, scope: "WORKSPACE", workspaceId: ctx.workspace.id, action: "STRIPE_CONNECT_CREATED", targetType: "PAYMENT_ACCOUNT", targetId: a.id } });
    }
    const link = await stripe.accountLinks.create({
      account: acct.stripeAccountId,
      type: "account_onboarding",
      refresh_url: `${env.appUrl}/app/settings/payments?refresh=1`,
      return_url: `${env.appUrl}/app/settings/payments?return=1`,
    });
    return { url: link.url };
  });
}

export async function syncStripeAccountAction() {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const acct = await db.paymentAccount.findUnique({ where: { workspaceId: ctx.workspace.id } });
    if (!acct) throw new AppError("No Stripe account connected yet.");
    const a = await getStripe().accounts.retrieve(acct.stripeAccountId);
    await db.paymentAccount.update({ where: { workspaceId: ctx.workspace.id }, data: { chargesEnabled: a.charges_enabled, payoutsEnabled: a.payouts_enabled, detailsSubmitted: a.details_submitted } });
    return null;
  }, "Stripe status refreshed.");
}

export async function stripeDashboardLinkAction() {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const acct = await db.paymentAccount.findUnique({ where: { workspaceId: ctx.workspace.id } });
    if (!acct) throw new AppError("No Stripe account connected yet.");
    const l = await getStripe().accounts.createLoginLink(acct.stripeAccountId);
    return { url: l.url };
  });
}
