"use client";

import { useState } from "react";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/form";
import { CURRENCIES, centsToInput } from "@/lib/money";
import { PROJECT_TYPES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LayoutTemplate, FilePlus2 } from "lucide-react";

export type ClientValues = {
  id?: string;
  firstName?: string;
  lastName?: string;
  company?: string | null;
  email?: string;
  phone?: string | null;
  billingEmail?: string | null;
  billingAddress?: string | null;
  country?: string | null;
  currency?: string;
  timezone?: string | null;
  preferredLanguage?: string;
  vatNumber?: string | null;
  companyRegistration?: string | null;
  notes?: string | null;
  tags?: string[];
};

export function CurrencySelect({ name = "currency", value }: { name?: string; value?: string }) {
  return (
    <Select name={name} defaultValue={value ?? "EUR"}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </Select>
  );
}

export function ClientFields({ v = {}, compact }: { v?: ClientValues; compact?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <Field label="First name" name="firstName"><Input name="firstName" defaultValue={v.firstName} required /></Field>
      <Field label="Last name" name="lastName"><Input name="lastName" defaultValue={v.lastName} /></Field>
      <Field label="Company" name="company" optional className="sm:col-span-2"><Input name="company" defaultValue={v.company ?? ""} /></Field>
      <Field label="Email" name="email"><Input name="email" type="email" defaultValue={v.email} required /></Field>
      <Field label="Phone" name="phone" optional><Input name="phone" type="tel" defaultValue={v.phone ?? ""} /></Field>
      {!compact && (
        <>
          <Field label="Billing email" name="billingEmail" optional hint="Invoices are sent here. Defaults to the main email."><Input name="billingEmail" type="email" defaultValue={v.billingEmail ?? ""} /></Field>
          <Field label="Currency" name="currency"><CurrencySelect value={v.currency} /></Field>
          <Field label="Billing address" name="billingAddress" optional className="sm:col-span-2"><Textarea name="billingAddress" rows={3} defaultValue={v.billingAddress ?? ""} /></Field>
          <Field label="Country" name="country" optional><Input name="country" defaultValue={v.country ?? ""} /></Field>
          <Field label="Timezone" name="timezone" optional><Input name="timezone" placeholder="Europe/Paris" defaultValue={v.timezone ?? ""} /></Field>
          <Field label="Preferred language" name="preferredLanguage">
            <Select name="preferredLanguage" defaultValue={v.preferredLanguage ?? "en"}>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
              <option value="it">Italiano</option>
              <option value="nl">Nederlands</option>
            </Select>
          </Field>
          <Field label="VAT / tax number" name="vatNumber" optional><Input name="vatNumber" defaultValue={v.vatNumber ?? ""} /></Field>
          <Field label="Company registration" name="companyRegistration" optional><Input name="companyRegistration" defaultValue={v.companyRegistration ?? ""} /></Field>
          <Field label="Tags" name="tags" optional hint="Comma separated."><Input name="tags" defaultValue={v.tags?.join(", ") ?? ""} /></Field>
          <Field label="Internal notes" name="notes" optional className="sm:col-span-2" hint="Never visible to the client."><Textarea name="notes" rows={3} defaultValue={v.notes ?? ""} /></Field>
        </>
      )}
      {compact && <input type="hidden" name="currency" value={v.currency ?? "EUR"} />}
    </div>
  );
}

export type ProjectValues = {
  id?: string;
  name?: string;
  clientId?: string;
  type?: string | null;
  description?: string | null;
  startDate?: Date | string | null;
  targetDate?: Date | string | null;
  managerId?: string | null;
  budgetCents?: number | null;
  currency?: string;
  portalEnabled?: boolean;
  status?: string;
};

export function ProjectFields({ v = {}, clients, members, templates, lockedClient }: { v?: ProjectValues; clients: { id: string; name: string }[]; members?: { id: string; name: string }[]; templates?: { id: string; name: string; phases: number }[]; lockedClient?: boolean }) {
  const [templateId, setTemplateId] = useState<string>("");
  return (
    <div className="space-y-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" name="name" className="sm:col-span-2"><Input name="name" defaultValue={v.name} required placeholder="Website Redesign" /></Field>
        <Field label="Client" name="clientId">
          <Select name="clientId" defaultValue={v.clientId ?? clients[0]?.id} disabled={lockedClient}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          {lockedClient && <input type="hidden" name="clientId" value={v.clientId} />}
        </Field>
        <Field label="Project type" name="type" optional>
          <Select name="type" defaultValue={v.type ?? ""}>
            <option value="">—</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description" name="description" optional className="sm:col-span-2"><Textarea name="description" rows={3} defaultValue={v.description ?? ""} /></Field>
        <Field label="Start date" name="startDate" optional><Input name="startDate" type="date" defaultValue={toDateInput(v.startDate)} /></Field>
        <Field label="Target date" name="targetDate" optional><Input name="targetDate" type="date" defaultValue={toDateInput(v.targetDate)} /></Field>
        {members && (
          <Field label="Project manager" name="managerId" optional>
            <Select name="managerId" defaultValue={v.managerId ?? ""}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <Field label="Budget" name="budget" optional><Input name="budget" inputMode="decimal" defaultValue={centsToInput(v.budgetCents)} placeholder="0.00" /></Field>
          <Field label="Currency" name="currency"><CurrencySelect value={v.currency} /></Field>
        </div>
        {v.status && (
          <Field label="Status" name="status">
            <Select name="status" defaultValue={v.status}>
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </Field>
        )}
        <div className="sm:col-span-2">
          <Checkbox name="portalEnabled" label="Visible in the client portal" description="The client can follow client-visible progress, files and deliverables." defaultChecked={v.portalEnabled ?? true} />
        </div>
      </div>
      {templates && (
        <div>
          <div className="mb-2 text-[13px] font-medium">Specification</div>
          <input type="hidden" name="templateId" value={templateId} />
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => setTemplateId("")} aria-pressed={templateId === ""} className={cn("flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors", templateId === "" ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}>
              <FilePlus2 className="size-4 shrink-0 text-muted" />
              <span><span className="block">Start from scratch</span><span className="text-xs text-subtle">Empty specification</span></span>
            </button>
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => setTemplateId(t.id)} aria-pressed={templateId === t.id} className={cn("flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors", templateId === t.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}>
                <LayoutTemplate className="size-4 shrink-0 text-muted" />
                <span className="min-w-0"><span className="block truncate">{t.name}</span><span className="text-xs text-subtle">{t.phases} phases</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
