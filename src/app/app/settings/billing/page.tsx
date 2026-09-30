import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth/context";
import { integrations } from "@/lib/env";
import { getWorkspacePlan, storageQuota, formatBytes, FEATURE_KEYS, type FeatureKey } from "@/lib/plans";
import { PlanPicker } from "@/components/app/settings-forms";
import { KeyValue, Badge } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Billing" };

export default async function Billing({ searchParams }: { searchParams: Promise<{ success?: string; changed?: string }> }) {
  const ctx = await requireWorkspace();
  if (ctx.member.role !== "OWNER") redirect("/app/settings");
  const sp = await searchParams;
  const [p, plans, q, projects, clients, members, payments] = await Promise.all([
    getWorkspacePlan(ctx.workspace.id),
    db.plan.findMany({ where: { isActive: true, isPublic: true }, include: { features: true }, orderBy: { sortOrder: "asc" } }),
    storageQuota(ctx.workspace.id),
    db.project.count({ where: { workspaceId: ctx.workspace.id, archivedAt: null, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } }),
    db.client.count({ where: { workspaceId: ctx.workspace.id, archivedAt: null } }),
    db.workspaceMember.count({ where: { workspaceId: ctx.workspace.id, role: { not: "OWNER" } } }),
    db.platformPayment.findMany({ where: { subscription: { workspaceId: ctx.workspace.id } }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const sub = p?.sub;
  const lim = (n: number, max: number | null | undefined) => `${n} / ${max === null || max === undefined ? "∞" : max}`;
  const statusTone = sub?.status === "ACTIVE" ? "success" : sub?.status === "TRIALING" && !p?.trialExpired ? "accent" : "danger";

  return (
    <div className="space-y-10">
      {sp.success && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">Thanks! Your subscription is being activated — it can take a few seconds to appear.</p>}
      {sp.changed && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">Plan change requested. It will be reflected here as soon as Stripe confirms it.</p>}
      <section>
        <h2 className="mb-3 text-[13px] font-semibold">Current subscription</h2>
        <div className="panel rounded-2xl px-5">
          <KeyValue items={[
            { k: "Plan", v: <span className="flex items-center justify-end gap-2">{p?.plan.name ?? "—"} <Badge tone={statusTone}>{p?.trialExpired ? "Trial ended" : sub?.status.toLowerCase().replace("_", " ")}</Badge></span> },
            { k: "Price", v: sub ? `${formatMoney(sub.priceCents, sub.currency)} / ${sub.interval}` : "—" },
            ...(sub?.status === "TRIALING" && sub.trialEndsAt ? [{ k: "Trial ends", v: fmtDate(sub.trialEndsAt) }] : []),
            ...(sub?.currentPeriodEnd ? [{ k: sub.cancelAtPeriodEnd ? "Ends on" : "Renews on", v: fmtDate(sub.currentPeriodEnd) }] : []),
            { k: "Active projects", v: lim(projects, p?.plan.activeProjectLimit) },
            { k: "Clients", v: lim(clients, p?.plan.clientLimit) },
            { k: "Collaborators", v: lim(members, p?.plan.collaboratorLimit) },
            { k: "Storage", v: `${formatBytes(q.used)} / ${q.limit === null ? "∞" : formatBytes(q.limit)}` },
            { k: "Features", v: p ? [...p.features].map((f) => FEATURE_KEYS[f as FeatureKey] ?? f).join(", ") || "—" : "—" },
          ]} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[13px] font-semibold">Change plan</h2>
        <PlanPicker
          plans={plans.map((pl) => ({ code: pl.code, name: pl.name, description: pl.description, monthly: pl.monthlyPriceCents, annual: pl.annualPriceCents, currency: pl.currency, highlight: pl.highlight, features: pl.features.filter((f) => f.enabled).map((f) => f.key) }))}
          currentCode={p?.plan.code ?? ""}
          configured={integrations.stripe()}
          hasCustomer={Boolean(sub?.stripeSubscriptionId)}
        />
      </section>
      {payments.length > 0 && (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold">Subscription payments</h2>
          <ul className="panel divide-y divide-line rounded-2xl text-sm">
            {payments.map((pp) => <li key={pp.id} className="flex items-center justify-between px-4 py-2.5"><span className="text-muted">{fmtDate(pp.paidAt ?? pp.createdAt)}</span><span className="num">{formatMoney(pp.amountCents, pp.currency)}</span><Badge tone={pp.status === "PAID" ? "success" : "danger"}>{pp.status.toLowerCase()}</Badge></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
