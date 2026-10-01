"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Field, Input, Select, Submit } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ClientFields, CurrencySelect, ProjectFields } from "./entity-fields";
import { createWorkspaceAction, finishOnboardingAction } from "@/server/actions/workspace";
import { createClientAction } from "@/server/actions/clients";
import { createProjectAction } from "@/server/actions/projects";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { Tr, useI18n } from "@/lib/i18n/client";

const redirectOf = (d: unknown) => (d as { redirect?: string } | null)?.redirect;
const INDUSTRIES = ["Web & software", "Design & branding", "Marketing & communication", "Consulting", "Architecture & interior", "Events", "Photography & video", "Other"];

export function OnboardingWorkspace({ plans, defaultPlan }: { plans: { code: string; name: string; price: number; currency: string; trialDays: number; description: string }[]; defaultPlan?: string }) {
  const { t, fmt } = useI18n();
  const [plan, setPlan] = useState(plans.find((p) => p.code === defaultPlan)?.code ?? plans[0]?.code ?? "");
  return (
    <Form action={createWorkspaceAction} redirectTo={redirectOf} className="space-y-6">
      <Field label="Workspace name" name="name" hint="Usually your company or studio name. Clients will see it."><Input name="name" required autoFocus placeholder={t("Studio North")} /></Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Industry" name="industry" optional>
          <Select name="industry" defaultValue="">
            <option value="">—</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{t(i)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" name="currency"><CurrencySelect /></Field>
      </div>
      <div>
        <div className="mb-2 text-[13px] font-medium"><Tr>Plan</Tr></div>
        <input type="hidden" name="plan" value={plan} />
        <div className="grid gap-2" role="radiogroup" aria-label={t("Plan")}>
          {plans.map((p) => (
            <button key={p.code} type="button" role="radio" aria-checked={plan === p.code} onClick={() => setPlan(p.code)} className={cn("flex items-center justify-between gap-4 rounded-xl border p-3.5 text-left transition-colors", plan === p.code ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}>
              <span>
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted">{p.description}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="num block text-sm font-medium">{fmt.money(p.price, p.currency)}<span className="text-xs text-muted"><Tr>/mo</Tr></span></span>
                <span className="text-[11px] text-subtle"><Tr>7-day free trial</Tr></span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle"><Tr>Your card is required to start the 7-day free trial. Nothing is charged today; billing begins automatically after the trial. You can cancel any time in Settings.</Tr></p>
      </div>
      <Submit size="lg" className="w-full"><Tr>Continue to secure payment</Tr></Submit>
    </Form>
  );
}

export function OnboardingClient({ currency }: { currency: string }) {
  return (
    <Form action={createClientAction} redirectTo="/onboarding?step=project" className="space-y-6">
      <ClientFields compact v={{ currency }} />
      <div className="flex items-center justify-between gap-3">
        <a href="/onboarding?step=project" className="text-sm text-muted hover:text-fg"><Tr>Skip for now</Tr></a>
        <Submit size="lg"><Tr>Continue</Tr></Submit>
      </div>
    </Form>
  );
}

export function OnboardingProject({ clients, templates, currency }: { clients: { id: string; name: string }[]; templates: { id: string; name: string; phases: number }[]; currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const finish = async (to?: string) => {
    const r = await finishOnboardingAction();
    if (!r.ok) return toast.error(r.error);
    router.push(to ?? "/app");
  };
  if (!clients.length)
    return (
      <div className="rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="text-sm text-muted"><Tr>Projects belong to a client. Add a client first, or skip and explore your workspace.</Tr></p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => router.push("/onboarding?step=client")}><Tr>Add a client</Tr></Button>
          <Button variant="primary" onClick={() => finish()}><Tr>Go to dashboard</Tr></Button>
        </div>
      </div>
    );
  return (
    <Form
      action={createProjectAction}
      refresh={false}
      onSuccess={(d) => finish((d as { redirect?: string }).redirect)}
      className="space-y-6"
    >
      <ProjectFields clients={clients} templates={templates} v={{ currency }} />
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => finish()} className="text-sm text-muted hover:text-fg"><Tr>Skip for now</Tr></button>
        <Submit size="lg"><Tr>Create project</Tr></Submit>
      </div>
    </Form>
  );
}
