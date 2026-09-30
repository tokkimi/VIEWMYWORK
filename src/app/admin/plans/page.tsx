import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { PlanDialog, SyncStripeButton } from "@/components/admin/plan-form";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { integrations } from "@/lib/env";

export const metadata = { title: "Plans" };

export default async function Plans() {
  await requireSuperAdmin();
  const plans = await db.plan.findMany({ include: { features: true, _count: { select: { subscriptions: true } } }, orderBy: { sortOrder: "asc" } });
  const lim = (v: number | null) => (v === null ? "∞" : String(v));
  return (
    <>
      <PageHeader title="Plans" description="Prices, quotas and features. Changes apply immediately to new subscriptions; existing subscriptions keep their price." actions={<PlanDialog featureKeys={FEATURE_KEYS} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="panel flex flex-col rounded-2xl p-5">
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-medium">{p.name}</div><div className="font-mono text-[11px] text-subtle">{p.code}</div></div>
              <div className="flex flex-wrap justify-end gap-1">{!p.isActive && <Badge tone="warning">Inactive</Badge>}{!p.isPublic && <Badge>Hidden</Badge>}{p.highlight && <Badge tone="accent">Highlighted</Badge>}</div>
            </div>
            <div className="num mt-4 text-2xl font-semibold">{formatMoney(p.monthlyPriceCents, p.currency)}<span className="text-xs font-normal text-muted">/mo</span></div>
            <div className="text-xs text-subtle">{p.annualPriceCents !== null ? `${formatMoney(p.annualPriceCents, p.currency)}/yr` : "No annual price"} · {p.trialDays}-day trial</div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-muted">Storage</dt><dd>{p.storageLimitMb === null ? "∞" : `${p.storageLimitMb} MB`}</dd></div>
              <div><dt className="text-muted">Projects</dt><dd>{lim(p.activeProjectLimit)}</dd></div>
              <div><dt className="text-muted">Clients</dt><dd>{lim(p.clientLimit)}</dd></div>
              <div><dt className="text-muted">Collaborators</dt><dd>{lim(p.collaboratorLimit)}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-1">{p.features.filter((f) => f.enabled).map((f) => <Badge key={f.key}>{FEATURE_KEYS[f.key as FeatureKey] ?? f.key}</Badge>)}</div>
            <div className="mt-4 text-xs text-subtle">{p._count.subscriptions} subscription{p._count.subscriptions === 1 ? "" : "s"} · Stripe {p.stripeMonthlyPriceId ? "linked" : "not linked"}</div>
            <div className="mt-auto flex gap-2 pt-4">
              <PlanDialog featureKeys={FEATURE_KEYS} plan={{ ...p, features: p.features.filter((f) => f.enabled).map((f) => f.key) }} />
              {integrations.stripe() && <SyncStripeButton id={p.id} />}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
