"use client";

import { Plus, Pencil, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Textarea, Submit, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CurrencySelect } from "@/components/app/entity-fields";
import { useActionButton } from "@/components/app/invoice-actions";
import { savePlanAction, syncPlanStripeAction } from "@/server/actions/admin";
import { centsToInput } from "@/lib/money";

type P = { id: string; code: string; name: string; description: string | null; monthlyPriceCents: number; annualPriceCents: number | null; currency: string; storageLimitMb: number | null; activeProjectLimit: number | null; clientLimit: number | null; collaboratorLimit: number | null; trialDays: number; sortOrder: number; isActive: boolean; isPublic: boolean; highlight: boolean; features: string[] };

export function PlanDialog({ plan, featureKeys }: { plan?: P; featureKeys: Record<string, string> }) {
  return (
    <Dialog size="lg" title={plan ? `Edit ${plan.name}` : "New plan"} description="Changing prices never affects existing subscriptions — they keep the price they signed up with." trigger={(open) => (plan ? <Button size="sm" onClick={open}><Pencil className="size-3.5" />Edit</Button> : <Button variant="primary" onClick={open}><Plus className="size-4" />New plan</Button>)}>
      {(close) => (
        <Form action={savePlanAction} onSuccess={close} className="space-y-6">
          {plan && <input type="hidden" name="id" value={plan.id} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Code" name="code"><Input name="code" defaultValue={plan?.code} required placeholder="PRO" /></Field>
            <Field label="Name" name="name" className="sm:col-span-2"><Input name="name" defaultValue={plan?.name} required /></Field>
            <Field label="Description" name="description" optional className="sm:col-span-3"><Textarea name="description" rows={2} defaultValue={plan?.description ?? ""} /></Field>
            <Field label="Monthly price" name="monthlyPrice"><Input name="monthlyPrice" inputMode="decimal" defaultValue={plan ? centsToInput(plan.monthlyPriceCents) : ""} required /></Field>
            <Field label="Annual price" name="annualPrice" optional><Input name="annualPrice" inputMode="decimal" defaultValue={plan?.annualPriceCents !== null && plan ? centsToInput(plan.annualPriceCents) : ""} /></Field>
            <Field label="Currency" name="currency"><CurrencySelect value={plan?.currency ?? "EUR"} /></Field>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">Limits <span className="font-normal text-subtle">(empty = unlimited)</span></div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Storage (MB)" name="storageLimitMb"><Input name="storageLimitMb" type="number" min={0} defaultValue={plan?.storageLimitMb ?? ""} /></Field>
              <Field label="Active projects" name="activeProjectLimit"><Input name="activeProjectLimit" type="number" min={0} defaultValue={plan?.activeProjectLimit ?? ""} /></Field>
              <Field label="Clients" name="clientLimit"><Input name="clientLimit" type="number" min={0} defaultValue={plan?.clientLimit ?? ""} /></Field>
              <Field label="Collaborators" name="collaboratorLimit"><Input name="collaboratorLimit" type="number" min={0} defaultValue={plan?.collaboratorLimit ?? ""} /></Field>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">Features</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(featureKeys).map(([k, label]) => <Checkbox key={k} name={`feature_${k}`} label={label} defaultChecked={plan?.features.includes(k)} />)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trial days" name="trialDays"><Input name="trialDays" type="number" min={0} max={365} defaultValue={plan?.trialDays ?? 14} /></Field>
            <Field label="Sort order" name="sortOrder"><Input name="sortOrder" type="number" min={0} defaultValue={plan?.sortOrder ?? 10} /></Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Checkbox name="isActive" label="Active" description="Available for new subscriptions." defaultChecked={plan?.isActive ?? true} />
            <Checkbox name="isPublic" label="Public" description="Shown on the pricing page." defaultChecked={plan?.isPublic ?? true} />
            <Checkbox name="highlight" label="Highlighted" defaultChecked={plan?.highlight} />
          </div>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Save plan</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function SyncStripeButton({ id }: { id: string }) {
  const { pending, run } = useActionButton();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => syncPlanStripeAction(id))}><RefreshCw className="size-3.5" />Sync Stripe</Button>;
}
