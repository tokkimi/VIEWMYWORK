import type { Metadata } from "next";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/plans";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

function limit(v: number | null, unit: string) {
  return v === null ? `Unlimited ${unit}` : `${v} ${unit}`;
}
function storage(mb: number | null) {
  if (mb === null) return "Unlimited storage";
  return mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB storage` : `${mb} MB storage`;
}

export default async function Pricing() {
  // Prices, quotas and features come from the Plan table, managed in Platform Administration.
  const plans = await db.plan.findMany({ where: { isActive: true, isPublic: true }, include: { features: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Simple pricing</h1>
        <p className="mt-4 text-muted">Start for the price of a coffee. Upgrade when your studio grows.</p>
      </div>
      {plans.length === 0 ? (
        <p className="mt-16 text-center text-muted">Plans are being configured. Please check back soon.</p>
      ) : (
        <div className={cn("mx-auto mt-14 grid gap-4", plans.length >= 3 ? "md:grid-cols-3" : "max-w-3xl md:grid-cols-2")}>
          {plans.map((p) => (
            <div key={p.id} className={cn("glass flex flex-col rounded-2xl p-7", p.highlight && "border-accent/50 ring-1 ring-accent/30")}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{p.name}</h2>
                {p.highlight && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-[#8fb0ff]">Popular</span>}
              </div>
              <p className="mt-1 min-h-10 text-sm text-muted">{p.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="num text-4xl font-semibold tracking-tight">{formatMoney(p.monthlyPriceCents, p.currency)}</span>
                <span className="text-sm text-muted">/month</span>
              </div>
              {p.annualPriceCents !== null && <p className="mt-1 text-xs text-subtle">or {formatMoney(p.annualPriceCents, p.currency)} billed yearly</p>}
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {[limit(p.activeProjectLimit, "active projects"), limit(p.clientLimit, "clients"), p.collaboratorLimit === 0 ? "Solo workspace" : limit(p.collaboratorLimit, "collaborators"), storage(p.storageLimitMb)].map((l) => (
                  <li key={l} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-accent" />{l}</li>
                ))}
                {p.features.filter((f) => f.enabled).map((f) => (
                  <li key={f.key} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-accent" />{f.label || FEATURE_KEYS[f.key as FeatureKey] || f.key}</li>
                ))}
              </ul>
              <ButtonLink href={`/signup?plan=${p.code}`} variant={p.highlight ? "primary" : "secondary"} className="mt-8 w-full">
                {p.trialDays > 0 ? `Start ${p.trialDays}-day trial` : "Get started"}
              </ButtonLink>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
