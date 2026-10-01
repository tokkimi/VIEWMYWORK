import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui/button";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { getI18n, pageTitle } from "@/lib/i18n/server";
import type { I18n } from "@/lib/i18n/core";

export const generateMetadata = pageTitle("Pricing");
export const dynamic = "force-dynamic";

function limit({ t }: I18n, v: number | null, unit: string) {
  return v === null ? t("Unlimited " + unit) : `${v} ${t(unit)}`;
}
function storage({ t, fmt }: I18n, mb: number | null) {
  if (mb === null) return t("Unlimited storage");
  return mb >= 1024 ? t("{size} GB storage", { size: fmt.number(Math.round((mb / 1024) * 10) / 10) }) : t("{size} MB storage", { size: mb });
}

export default async function Pricing() {
  const i18n = await getI18n();
  const { t, fmt } = i18n;
  // Prices, quotas and features come from the Plan table, managed in Platform Administration.
  const plans = await db.plan.findMany({ where: { isActive: true, isPublic: true }, include: { features: true }, orderBy: { sortOrder: "asc" } }).catch(() => []);
  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("Simple pricing")}</h1>
        <p className="mt-4 text-muted">{t("Start for the price of a coffee. Upgrade when your studio grows.")}</p>
      </div>
      {plans.length === 0 ? (
        <p className="mt-16 text-center text-muted">{t("Plans are being configured. Please check back soon.")}</p>
      ) : (
        <div className={cn("mx-auto mt-14 grid gap-4", plans.length >= 3 ? "md:grid-cols-3" : "max-w-3xl md:grid-cols-2")}>
          {plans.map((p) => (
            <div key={p.id} className={cn("glass flex flex-col rounded-2xl p-7", p.highlight && "border-accent/50 ring-1 ring-accent/30")}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{p.name}</h2>
                {p.highlight && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-[#8fb0ff]">{t("Popular")}</span>}
              </div>
              <p className="mt-1 min-h-10 text-sm text-muted">{p.description ? t(p.description) : null}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="num text-4xl font-semibold tracking-tight">{fmt.money(p.monthlyPriceCents, p.currency)}</span>
                <span className="text-sm text-muted">{t("/month")}</span>
              </div>
              {p.annualPriceCents !== null && <p className="mt-1 text-xs text-subtle">{t("or {amount} billed yearly", { amount: fmt.money(p.annualPriceCents, p.currency) })}</p>}
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {[limit(i18n, p.activeProjectLimit, "active projects"), limit(i18n, p.clientLimit, "clients"), p.collaboratorLimit === 0 ? t("Solo workspace") : limit(i18n, p.collaboratorLimit, "collaborators"), storage(i18n, p.storageLimitMb)].map((l) => (
                  <li key={l} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-accent" />{l}</li>
                ))}
                {p.features.filter((f) => f.enabled).map((f) => (
                  <li key={f.key} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-accent" />{t(f.label || FEATURE_KEYS[f.key as FeatureKey] || f.key)}</li>
                ))}
              </ul>
              <ButtonLink href={`/signup?plan=${p.code}`} variant={p.highlight ? "primary" : "secondary"} className="mt-8 w-full">
                {t("Start {n}-day trial", { n: 7 })}
              </ButtonLink>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
