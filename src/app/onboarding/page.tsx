import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerifiedUser, getWorkspaceCtx } from "@/lib/auth/context";
import { Logo } from "@/components/logo";
import { OnboardingWorkspace, OnboardingClient, OnboardingProject } from "@/components/app/onboarding-forms";
import { cn } from "@/lib/cn";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Set up your workspace");

const steps = ["Workspace", "First client", "First project"];

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ step?: string; plan?: string; new?: string; billing?: string }> }) {
  const { t } = await getI18n();
  const user = await requireVerifiedUser();
  const sp = await searchParams;
  const ctx = await getWorkspaceCtx();

  let step = 0;
  if (ctx && !sp.new) {
    if (ctx.workspace.onboardingDone && !sp.step) redirect("/app");
    step = sp.step === "project" ? 2 : 1;
  } else if (!ctx) {
    const portal = await db.clientPortalAccess.findFirst({ where: { userId: user.id, revokedAt: null } });
    if (portal && !sp.new && !sp.plan) redirect("/portal");
  }

  const plans = step === 0 ? await db.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } }) : [];
  const clients = step === 2 && ctx ? await db.client.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 50 }) : [];
  const templates = step === 2 && ctx ? await db.projectTemplate.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: ctx.workspace.id }] }, orderBy: { name: "asc" }, include: { phases: { select: { id: true } } } }) : [];

  return (
    <div className="relative min-h-dvh">
      <div className="glow pointer-events-none absolute inset-x-0 top-0 h-96" />
      <header className="relative flex items-center justify-between px-6 py-6">
        <Logo href="/app" />
        <ol className="hidden items-center gap-6 text-xs sm:flex" aria-label={t("Onboarding steps")}>
          {steps.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2", i === step ? "text-fg" : i < step ? "text-muted" : "text-subtle")} aria-current={i === step ? "step" : undefined}>
              <span className={cn("flex size-5 items-center justify-center rounded-full border text-[10px]", i <= step ? "border-accent text-accent" : "border-line")}>{i + 1}</span>
              {t(s)}
            </li>
          ))}
        </ol>
      </header>
      <main id="main" className="relative mx-auto max-w-xl px-5 pb-20 pt-6 sm:pt-12">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight"><Tr>Welcome,</Tr> {user.name.split(" ")[0]}</h1>
            <p className="mt-1.5 text-sm text-muted"><Tr>Let&apos;s set up your workspace. It takes less than a minute.</Tr></p>
            <div className="mt-8">
              <OnboardingWorkspace plans={plans.map((p) => ({ code: p.code, name: p.name, price: p.monthlyPriceCents, currency: p.currency, trialDays: 7, description: p.description ?? "" }))} defaultPlan={sp.plan} />
            </div>
          </>
        )}
        {step === 1 && ctx && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight"><Tr>Add your first client</Tr></h1>
            <p className="mt-1.5 text-sm text-muted"><Tr>Who are you working for? You can invite them to their portal later.</Tr></p>
            <div className="mt-8"><OnboardingClient currency={ctx.workspace.defaultCurrency} /></div>
          </>
        )}
        {step === 2 && ctx && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight"><Tr>Create your first project</Tr></h1>
            <p className="mt-1.5 text-sm text-muted"><Tr>Start from a proven structure or from scratch.</Tr></p>
            <div className="mt-8">
              <OnboardingProject
                clients={clients.map((c) => ({ id: c.id, name: c.company || `${c.firstName} ${c.lastName}` }))}
                templates={templates.map((t) => ({ id: t.id, name: t.name, phases: t.phases.length }))}
                currency={ctx.workspace.defaultCurrency}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
