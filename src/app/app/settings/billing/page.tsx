import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth/context";
import { integrations } from "@/lib/env";
import { getWorkspacePlan, storageQuota, formatBytes, FEATURE_KEYS, type FeatureKey } from "@/lib/plans";
import { PlanPicker } from "@/components/app/settings-forms";
import { KeyValue, Badge } from "@/components/ui/primitives";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Billing");

export default async function Billing({ searchParams }: { searchParams: Promise<{ success?: string; changed?: string }> }) {
  const { t, fmt } = await getI18n();
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
      <section className="rounded-2xl border border-accent/30 bg-accent-soft px-5 py-5">
        <h1 className="text-lg font-semibold"><Tr>Manage your subscription</Tr></h1>
        <p className="mt-1 text-sm text-muted"><Tr>Update your plan, payment method or billing details, and cancel whenever you need.</Tr></p>
      </section>
      {sp.success && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success"><Tr>Thanks! Your subscription is being activated — it can take a few seconds to appear.</Tr></p>}
      {sp.changed && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success"><Tr>Plan change requested. It will be reflected here as soon as Stripe confirms it.</Tr></p>}
      <section>
        <h2 className="mb-3 text-[13px] font-semibold"><Tr>Current subscription</Tr></h2>
        <div className="panel rounded-2xl px-5">
          <KeyValue items={[
            { k: "Plan", v: <span className="flex items-center justify-end gap-2">{p?.plan.name ?? "—"} <Badge tone={statusTone}>{p?.trialExpired ? "Trial ended" : sub?.status.toLowerCase().replace("_", " ")}</Badge></span> },
            { k: "Price", v: sub ? `${fmt.money(sub.priceCents, sub.currency)} / ${t(sub.interval)}` : "—" },
            ...(sub?.status === "TRIALING" && sub.trialEndsAt ? [{ k: "Trial ends", v: fmt.date(sub.trialEndsAt) }] : []),
            ...(sub?.currentPeriodEnd ? [{ k: sub.cancelAtPeriodEnd ? t("Ends on") : t("Renews on"), v: fmt.date(sub.currentPeriodEnd) }] : []),
            { k: "Active projects", v: lim(projects, p?.plan.activeProjectLimit) },
            { k: "Clients", v: lim(clients, p?.plan.clientLimit) },
            { k: "Collaborators", v: lim(members, p?.plan.collaboratorLimit) },
            { k: "Storage", v: `${formatBytes(q.used)} / ${q.limit === null ? "∞" : formatBytes(q.limit)}` },
            { k: "Features", v: p ? [...p.features].map((f) => FEATURE_KEYS[f as FeatureKey] ?? f).join(", ") || "—" : "—" },
          ]} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-[13px] font-semibold"><Tr>Change plan</Tr></h2>
        <PlanPicker
          plans={plans.map((pl) => ({ code: pl.code, name: pl.name, description: pl.description, monthly: pl.monthlyPriceCents, annual: pl.annualPriceCents, currency: pl.currency, highlight: pl.highlight, features: pl.features.filter((f) => f.enabled).map((f) => f.key) }))}
          currentCode={p?.plan.code ?? ""}
          configured={integrations.stripe()}
          hasSubscription={Boolean(sub?.stripeSubscriptionId)}
          hasBillingAccount={Boolean(sub?.stripeCustomerId)}
        />
      </section>
      {payments.length > 0 && (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold"><Tr>Subscription payments</Tr></h2>
          <ul className="panel divide-y divide-line rounded-2xl text-sm">
            {payments.map((pp) => <li key={pp.id} className="flex items-center justify-between px-4 py-2.5"><span className="text-muted">{fmt.date(pp.paidAt ?? pp.createdAt)}</span><span className="num">{fmt.money(pp.amountCents, pp.currency)}</span><Badge tone={pp.status === "PAID" ? "success" : "danger"}>{pp.status.toLowerCase()}</Badge></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
