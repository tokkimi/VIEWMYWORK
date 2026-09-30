import { db } from "@/lib/db";

/**
 * Platform (Domain A) revenue only: professionals' subscriptions to this SaaS.
 * Client invoice payments (Domain B) are never included here.
 */
export async function platformRevenue() {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const [active, newSubs, canceled] = await Promise.all([
    db.subscription.findMany({ where: { status: { in: ["ACTIVE", "PAST_DUE"] }, stripeSubscriptionId: { not: null } }, select: { priceCents: true, interval: true, currency: true, createdAt: true } }),
    db.subscription.findMany({ where: { status: { in: ["ACTIVE", "PAST_DUE"] }, stripeSubscriptionId: { not: null }, updatedAt: { gte: d30 }, createdAt: { gte: d30 } }, select: { priceCents: true, interval: true } }),
    db.subscription.findMany({ where: { status: "CANCELED", canceledAt: { gte: d30 } }, select: { priceCents: true, interval: true } }),
  ]);
  const monthly = (s: { priceCents: number; interval: string }) => (s.interval === "year" ? Math.round(s.priceCents / 12) : s.priceCents);
  // MRR is reported in EUR (platform currency); other currencies are listed separately.
  const mrr = active.filter((s) => s.currency === "EUR").reduce((a, s) => a + monthly(s), 0);
  return { mrr, arr: mrr * 12, paying: active.length, newMrr: newSubs.reduce((a, s) => a + monthly(s), 0), newCount: newSubs.length, lostMrr: canceled.reduce((a, s) => a + monthly(s), 0), cancellations: canceled.length };
}
