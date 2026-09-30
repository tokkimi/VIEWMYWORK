import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Stat, Section } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts";
import { platformRevenue } from "@/server/queries/admin";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Revenue" };

/** Platform subscription revenue only (Domain A). Client invoice money is never counted here. */
export default async function AdminRevenue() {
  await requireSuperAdmin();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const [rev, payments, failed] = await Promise.all([
    platformRevenue(),
    db.platformPayment.findMany({ where: { status: "PAID", paidAt: { gte: start }, currency: "EUR" }, select: { amountCents: true, paidAt: true } }),
    db.platformPayment.count({ where: { status: "FAILED", createdAt: { gte: new Date(now.getTime() - 30 * 86400_000) } } }),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)));
  const data = months.map((m) => ({ label: m.toISOString().slice(5, 7), value: payments.filter((p) => p.paidAt && p.paidAt.getUTCMonth() === m.getUTCMonth() && p.paidAt.getUTCFullYear() === m.getUTCFullYear()).reduce((a, p) => a + p.amountCents, 0) }));
  return (
    <>
      <PageHeader title="Platform revenue" description="Subscriptions paid by professionals to ViewMyWork. Excludes all client invoice payments." />
      <div className="panel grid grid-cols-2 divide-x divide-line overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="MRR" value={formatMoney(rev.mrr, "EUR")} tone="accent" />
        <Stat label="ARR" value={formatMoney(rev.arr, "EUR")} />
        <Stat label="New MRR" value={formatMoney(rev.newMrr, "EUR")} hint="30 days" />
        <Stat label="Lost MRR" value={formatMoney(rev.lostMrr, "EUR")} hint="30 days" tone={rev.lostMrr ? "danger" : undefined} />
        <Stat label="Paying" value={rev.paying} />
        <Stat label="Failed payments" value={failed} hint="30 days" tone={failed ? "warning" : undefined} />
      </div>
      <Section title="Subscription payments collected" description="Last 12 months (EUR)" className="mt-10"><div className="panel rounded-2xl p-5"><BarChart data={data} format={(v) => formatMoney(v, "EUR")} /></div></Section>
    </>
  );
}
