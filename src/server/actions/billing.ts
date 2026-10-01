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
  if (!session.url) throw new AppError("The payment page couldn't be opened. Please try again.", "CONFIG");
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
    if (!(i.interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId)) plan = await syncPlanToStripe(plan.id);
    const priceId = i.interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId;
    if (!priceId) throw new AppError("This billing interval isn't offered for this plan.");

    const sub = await db.subscription.findUnique({ where: { workspaceId: ctx.workspace.id } });
    if (sub?.stripeSubscriptionId && sub.status !== "CANCELED") {
      // Existing customer: change plan in place, never a second subscription.
      await applyPlanChange(ctx.workspace.id, i.planCode, i.interval);
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

type ChangeCtx = Awaited<ReturnType<typeof loadPlanChange>>;

async function loadPlanChange(workspaceId: string, planCode: string, interval: "month" | "year") {
  let plan = await db.plan.findFirst({ where: { code: planCode, isActive: true } });
  if (!plan) throw new AppError("This plan isn't available.");
  if (!(interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId)) plan = await syncPlanToStripe(plan.id);
  const priceId = interval === "month" ? plan.stripeMonthlyPriceId : plan.stripeAnnualPriceId;
  const amount = interval === "month" ? plan.monthlyPriceCents : plan.annualPriceCents;
  if (!priceId || amount === null) throw new AppError("This billing interval isn't offered for this plan.");
  const sub = await db.subscription.findUnique({ where: { workspaceId } });
  if (!sub?.stripeSubscriptionId || sub.status === "CANCELED") return { plan, priceId, amount, sub, remote: null };
  const remote = await getStripe().subscriptions.retrieve(sub.stripeSubscriptionId);
  return { plan, priceId, amount, sub, remote };
}

const trialing = (c: ChangeCtx) => c.remote?.status === "trialing" && Boolean(c.remote.trial_end && c.remote.trial_end * 1000 > Date.now());

/**
 * What a plan change will cost, before confirming: during a trial nothing is charged; otherwise the
 * unused part of the current plan is credited and only the difference is charged today
 * (or credited on the next invoices for a cheaper plan).
 */
export async function previewPlanChangeAction(planCode: string, interval: "month" | "year") {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requireOwner(ctx.member.role);
    const i = z.object({ planCode: z.string().max(40), interval: z.enum(["month", "year"]) }).parse({ planCode, interval });
    const c = await loadPlanChange(ctx.workspace.id, i.planCode, i.interval);
    const base = { planName: c.plan.name, amount: c.amount, currency: c.plan.currency, interval: i.interval };
    if (!c.remote) return { ...base, mode: "new" as const, dueNow: c.amount, credit: 0, nextDate: null as string | null };
    if (c.remote.items.data[0]?.price.id === c.priceId) throw new AppError("You're already on this plan.");
    if (trialing(c)) return { ...base, mode: "trial" as const, dueNow: 0, credit: 0, nextDate: new Date(c.remote.trial_end! * 1000).toISOString() };
    const prorationDate = Math.floor(Date.now() / 1000);
    const preview = await getStripe().invoices.createPreview({
      customer: c.remote.customer as string,
      subscription: c.remote.id,
      subscription_details: { items: [{ id: c.remote.items.data[0]!.id, price: c.priceId }], proration_behavior: "always_invoice", proration_date: prorationDate },
    });
    const currentInterval = c.remote.items.data[0]?.price.recurring?.interval;
    const periodEnd = c.remote.items.data[0]?.current_period_end;
    const next = currentInterval !== i.interval
      ? new Date(Date.now() + (i.interval === "year" ? 365 : 30) * 86_400_000)
      : periodEnd ? new Date(periodEnd * 1000) : c.sub?.currentPeriodEnd ?? null;
    return { ...base, mode: "change" as const, dueNow: Math.max(0, preview.amount_due), credit: preview.total < 0 ? -preview.total : 0, nextDate: next?.toISOString() ?? null, prorationDate };
  });
}

/** Applies the change: the difference is charged immediately with the card on file. */
async function applyPlanChange(workspaceId: string, planCode: string, interval: "month" | "year", prorationDate?: number) {
  const c = await loadPlanChange(workspaceId, planCode, interval);
  if (!c.remote || !c.sub) throw new AppError("No subscription record was found for this workspace.", "NOT_FOUND");
  const stripe = getStripe();
  const item = c.remote.items.data[0]!;
  const updated = trialing(c)
    ? await stripe.subscriptions.update(c.remote.id, { items: [{ id: item.id, price: c.priceId }], proration_behavior: "none" })
    // If the payment fails, nothing changes (the update stays pending and expires).
    : await stripe.subscriptions.update(c.remote.id, { items: [{ id: item.id, price: c.priceId }], proration_behavior: "always_invoice", payment_behavior: "pending_if_incomplete", ...(prorationDate ? { proration_date: prorationDate } : {}) });
  if (updated.pending_update) throw new AppError("The payment didn't go through, so your plan hasn't changed. Check your payment method and try again.");
  await db.subscription.update({
    where: { id: c.sub.id },
    data: { planId: c.plan.id, stripePriceId: c.priceId, priceCents: c.amount, currency: c.plan.currency, interval, cancelAtPeriodEnd: updated.cancel_at_period_end },
  });
}

export async function changePlanAction(planCode: string, interval: "month" | "year", prorationDate?: number) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requireOwner(ctx.member.role);
    const i = z.object({ planCode: z.string().max(40), interval: z.enum(["month", "year"]), prorationDate: z.number().int().positive().optional() }).parse({ planCode, interval, prorationDate });
    // A quote older than an hour is recomputed at the current time.
    const fresh = i.prorationDate && Date.now() / 1000 - i.prorationDate < 3600 ? i.prorationDate : undefined;
    await applyPlanChange(ctx.workspace.id, i.planCode, i.interval, fresh);
    return { url: `${env.appUrl}/app/settings/billing?changed=1` };
  });
}
