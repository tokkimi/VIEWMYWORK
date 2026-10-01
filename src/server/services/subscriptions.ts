import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { notifyWorkspaceAdmins } from "@/lib/events";

/**
 * DOMAIN A — platform subscriptions (professionals paying for this SaaS).
 * Entirely separate from client invoices/payments: own tables, own webhook endpoint,
 * own reporting (Super Admin revenue).
 */

/** Creates (or reuses) Stripe prices for a plan. Prices are immutable, so a price change creates a new Price. */
export async function syncPlanToStripe(planId: string) {
  const stripe = getStripe();
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });
  let productId = plan.stripeProductId;
  if (!productId) productId = (await stripe.products.create({ name: `FollowMyFuture ${plan.name}`, metadata: { planId: plan.id, planCode: plan.code } })).id;
  else await stripe.products.update(productId, { name: `FollowMyFuture ${plan.name}` });

  async function ensurePrice(existingId: string | null, amount: number | null, interval: "month" | "year") {
    if (amount === null) return null;
    if (existingId) {
      const p = await stripe.prices.retrieve(existingId);
      if (p.active && p.unit_amount === amount && p.currency === plan.currency.toLowerCase() && p.recurring?.interval === interval) return existingId;
      await stripe.prices.update(existingId, { active: false }); // existing subscriptions keep their old price
    }
    return (await stripe.prices.create({ product: productId!, unit_amount: amount, currency: plan.currency.toLowerCase(), recurring: { interval }, metadata: { planId: plan.id } })).id;
  }
  const monthly = await ensurePrice(plan.stripeMonthlyPriceId, plan.monthlyPriceCents, "month");
  const annual = await ensurePrice(plan.stripeAnnualPriceId, plan.annualPriceCents, "year");
  return db.plan.update({ where: { id: planId }, data: { stripeProductId: productId, stripeMonthlyPriceId: monthly, stripeAnnualPriceId: annual } });
}

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  if (s === "trialing") return "TRIALING";
  if (s === "active") return "ACTIVE";
  if (s === "past_due" || s === "unpaid") return "PAST_DUE";
  if (s === "canceled" || s === "incomplete_expired") return "CANCELED";
  return "INCOMPLETE";
}

async function applyStripeSubscription(sub: Stripe.Subscription) {
  const workspaceId = sub.metadata?.workspaceId;
  const local = workspaceId ? await db.subscription.findUnique({ where: { workspaceId } }) : await db.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (!local) return;
  const item = sub.items.data[0];
  const price = item?.price;
  const plan = price ? await db.plan.findFirst({ where: { OR: [{ stripeMonthlyPriceId: price.id }, { stripeAnnualPriceId: price.id }, { stripeProductId: typeof price.product === "string" ? price.product : price.product?.id }] } }) : null;
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  await db.subscription.update({
    where: { id: local.id },
    data: {
      status: mapStatus(sub.status),
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripePriceId: price?.id ?? local.stripePriceId,
      priceCents: price?.unit_amount ?? local.priceCents, // actual price locked on the subscription
      currency: (price?.currency ?? local.currency).toUpperCase(),
      interval: price?.recurring?.interval ?? local.interval,
      planId: plan?.id ?? local.planId,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : local.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : local.trialEndsAt,
    },
  });
}

export async function handlePlatformEvent(event: Stripe.Event) {
  const stripe = getStripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode !== "subscription" || !s.subscription) return;
      await applyStripeSubscription(await stripe.subscriptions.retrieve(String(s.subscription)));
      return;
    }
    // Stripe sends this 3 days before the trial ends: tell the owner what will be charged and when.
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      await applyStripeSubscription(sub);
      const local = await db.subscription.findUnique({ where: { stripeSubscriptionId: sub.id }, include: { plan: true } });
      if (!local || !sub.trial_end || sub.cancel_at_period_end) return;
      await notifyWorkspaceAdmins(local.workspaceId, "SUBSCRIPTION_TRIAL_ENDING", "Your free trial ends soon",
        ["Your {plan} plan starts on {date}: {amount} will be charged to your card on file. You can change plan or cancel before then.", { plan: local.plan.name, date: { date: new Date(sub.trial_end * 1000) }, amount: { money: local.priceCents, currency: local.currency } }],
        "/app/settings/billing");
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applyStripeSubscription(event.data.object as Stripe.Subscription);
      return;
    // Some webhook configurations deliver invoice lifecycle events before the
    // subscription events. Syncing from these keeps the local trial state and
    // cancellation state accurate without waiting for the first payment.
    case "invoice.created":
    case "invoice.updated":
    case "invoice.finalized": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = (inv as unknown as { subscription?: string | null }).subscription ?? inv.parent?.subscription_details?.subscription;
      if (subId) await applyStripeSubscription(await stripe.subscriptions.retrieve(String(subId)));
      return;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = (inv as unknown as { subscription?: string | null }).subscription ?? (inv.parent?.subscription_details?.subscription as string | undefined);
      if (subId) await applyStripeSubscription(await stripe.subscriptions.retrieve(String(subId)));
      const local = subId ? await db.subscription.findUnique({ where: { stripeSubscriptionId: String(subId) } }) : inv.customer ? await db.subscription.findUnique({ where: { stripeCustomerId: String(inv.customer) } }) : null;
      if (!local || !inv.id) return;
      const paid = event.type === "invoice.paid";
      // 0 € invoices (trial start, credited changes) aren't payments: keep the history to real charges.
      if (paid && inv.amount_paid <= 0) return;
      await db.platformPayment.upsert({
        where: { stripeInvoiceId: inv.id },
        create: { subscriptionId: local.id, stripeInvoiceId: inv.id, amountCents: paid ? inv.amount_paid : inv.amount_due, currency: inv.currency.toUpperCase(), status: paid ? "PAID" : "FAILED", paidAt: paid ? new Date() : null },
        update: { status: paid ? "PAID" : "FAILED", amountCents: paid ? inv.amount_paid : inv.amount_due, paidAt: paid ? new Date() : null },
      });
      if (!paid) {
        await db.subscription.update({ where: { id: local.id }, data: { status: "PAST_DUE" } });
        await notifyWorkspaceAdmins(local.workspaceId, "SUBSCRIPTION_PAYMENT_FAILED", "Subscription payment failed", "We couldn't charge your card for your FollowMyFuture subscription. Update your payment method to avoid interruption.", "/app/settings/billing");
      }
      return;
    }
  }
}
