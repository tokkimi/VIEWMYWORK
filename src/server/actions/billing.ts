"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { requireWorkspace } from "@/lib/auth/context";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { syncPlanToStripe } from "@/server/services/subscriptions";

function requireOwner(role: string) {
  if (role !== "OWNER") throw new AppError("Only the workspace owner can manage the subscription.", "FORBIDDEN");
}

/** Starts a Stripe Checkout for the platform subscription. The price comes from the Plan table, never the browser. */
export async function startSubscriptionCheckoutAction(planCode: string, interval: "month" | "year") {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requireOwner(ctx.member.role);
    const i = z.object({ planCode: z.string().max(40), interval: z.enum(["month", "year"]) }).parse({ planCode, interval });
    let plan = await db.plan.findFirst({ where: { code: i.planCode, isActive: true } });
    if (!plan) throw new AppError("This plan isn't available.");
    const stripe = getStripe();
    if (!(i.interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId)) plan = await syncPlanToStripe(plan.id);
    const priceId = i.interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId;
    if (!priceId) throw new AppError("This billing interval isn't offered for this plan.");

    const sub = await db.subscription.findUnique({ where: { workspaceId: ctx.workspace.id } });
    if (sub?.stripeSubscriptionId && sub.status !== "CANCELED") {
      // Existing paying customer: change plan in place (prorated) instead of a second subscription.
      const s = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      await stripe.subscriptions.update(s.id, { items: [{ id: s.items.data[0].id, price: priceId }], proration_behavior: "create_prorations", metadata: { workspaceId: ctx.workspace.id } });
      return { url: `${env.appUrl}/app/settings/billing?changed=1` };
    }
    let customer = sub?.stripeCustomerId;
    if (!customer) {
      customer = (await stripe.customers.create({ email: ctx.user.email, name: ctx.workspace.name, metadata: { workspaceId: ctx.workspace.id } })).id;
      await db.subscription.update({ where: { workspaceId: ctx.workspace.id }, data: { stripeCustomerId: customer } });
    }
    const trialEnd = sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt.getTime() > Date.now() + 48 * 3600_000 ? Math.floor(sub.trialEndsAt.getTime() / 1000) : undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { workspaceId: ctx.workspace.id, planId: plan.id }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
      metadata: { workspaceId: ctx.workspace.id, kind: "platform_subscription" },
      success_url: `${env.appUrl}/app/settings/billing?success=1`,
      cancel_url: `${env.appUrl}/app/settings/billing`,
    });
    return { url: session.url! };
  });
}

export async function openBillingPortalAction() {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requireOwner(ctx.member.role);
    const sub = await db.subscription.findUnique({ where: { workspaceId: ctx.workspace.id } });
    if (!sub?.stripeCustomerId) throw new AppError("No billing account yet. Choose a plan first.");
    const s = await getStripe().billingPortal.sessions.create({ customer: sub.stripeCustomerId, return_url: `${env.appUrl}/app/settings/billing` });
    return { url: s.url };
  });
}
