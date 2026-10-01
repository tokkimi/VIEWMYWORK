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

/**
 * Creates the first Checkout session for a workspace.  Checkout deliberately
 * always collects a card: a trial without a payment method cannot convert
 * automatically at its end.
 */
export async function createPlatformCheckoutSession(input: {
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
  planId: string;
  interval: "month" | "year";
  subscriptionId: string;
  stripeCustomerId: string | null;
  trialEndsAt: Date | null;
  successUrl: string;
  cancelUrl: string;
}) {
  let plan = await db.plan.findFirst({ where: { id: input.planId, isActive: true } });
  if (!plan) throw new AppError("This plan isn't available.");

  const stripe = getStripe();
  if (!(input.interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId)) plan = await syncPlanToStripe(plan.id);
  const priceId = input.interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId;
  if (!priceId) throw new AppError("This billing interval isn't offered for this plan.");

  let customer = input.stripeCustomerId;
  if (!customer) {
    customer = (await stripe.customers.create({ email: input.userEmail, name: input.workspaceName, metadata: { workspaceId: input.workspaceId } })).id;
    await db.subscription.update({ where: { id: input.subscriptionId }, data: { stripeCustomerId: customer } });
  }
  const trialEnd = input.trialEndsAt && input.trialEndsAt.getTime() > Date.now() + 48 * 3600_000 ? Math.floor(input.trialEndsAt.getTime() / 1000) : undefined;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    // A card is collected now but not charged while the subscription is trialing.
    payment_method_collection: "always",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { workspaceId: input.workspaceId, planId: plan.id }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
    metadata: { workspaceId: input.workspaceId, kind: "platform_subscription" },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  if (!session.url) throw new AppError("Stripe couldn't create the checkout page. Please try again.", "CONFIG");
  return session.url;
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
      const changed = await stripe.subscriptions.update(s.id, { items: [{ id: s.items.data[0].id, price: priceId }], proration_behavior: "create_prorations", metadata: { workspaceId: ctx.workspace.id } });
      // Reflect the selected plan immediately. Webhooks remain authoritative for
      // billing status and period dates, but the UI must not keep showing the old plan.
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          planId: plan.id,
          stripePriceId: priceId,
          priceCents: i.interval === "month" ? plan.monthlyPriceCents : plan.annualPriceCents ?? plan.monthlyPriceCents,
          currency: plan.currency,
          interval: i.interval,
          cancelAtPeriodEnd: changed.cancel_at_period_end,
        },
      });
      return { url: `${env.appUrl}/app/settings/billing?changed=1` };
    }
    if (!sub) throw new AppError("No subscription record was found for this workspace.", "NOT_FOUND");
    const url = await createPlatformCheckoutSession({
      workspaceId: ctx.workspace.id,
      workspaceName: ctx.workspace.name,
      userEmail: ctx.user.email,
      planId: plan.id,
      interval: i.interval,
      subscriptionId: sub.id,
      stripeCustomerId: sub.stripeCustomerId,
      trialEndsAt: sub.status === "TRIALING" ? sub.trialEndsAt : null,
      successUrl: `${env.appUrl}/app/settings/billing?success=1`,
      cancelUrl: `${env.appUrl}/app/settings/billing`,
    });
    return { url };
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
