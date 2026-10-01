"use client";

import { Form, Field, Input, Textarea, Select, Submit, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CurrencySelect } from "./entity-fields";
import { updateWorkspaceGeneralAction, updateBrandingAction, uploadLogoAction, removeLogoAction } from "@/server/actions/workspace";
import { saveInvoiceSettingsAction } from "@/server/actions/invoices";
import { connectStripeAction, syncStripeAccountAction, stripeDashboardLinkAction } from "@/server/actions/payments";
import { startSubscriptionCheckoutAction, openBillingPortalAction } from "@/server/actions/billing";
import { disconnectDriveAction, setDriveFolderAction } from "@/server/actions/integrations";
import { useActionButton } from "./invoice-actions";
import { formatInvoiceNumber } from "@/lib/invoices/numbering";
import { useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tr, useI18n } from "@/lib/i18n/client";

type WS = { name: string; industry: string | null; defaultCurrency: string; timezone: string; locale: string };
type Company = { companyLegalName?: string | null; companyAddress?: string | null; companyEmail?: string | null; companyPhone?: string | null; companyVatNumber?: string | null; companyRegistration?: string | null; companyCountry?: string | null };

export function GeneralForm({ ws, company }: { ws: WS; company: Company }) {
  const { t } = useI18n();
  return (
    <Form action={updateWorkspaceGeneralAction} className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Workspace name" name="name" className="sm:col-span-2"><Input name="name" defaultValue={ws.name} required /></Field>
        <Field label="Industry" name="industry" optional><Input name="industry" defaultValue={ws.industry ?? ""} /></Field>
        <Field label="Default currency" name="defaultCurrency"><CurrencySelect name="defaultCurrency" value={ws.defaultCurrency} /></Field>
        <Field label="Timezone" name="timezone"><Input name="timezone" defaultValue={ws.timezone} /></Field>
        <Field label="Language" name="locale"><Select name="locale" defaultValue={ws.locale}><option value="en">{t("English")}</option><option value="fr">{t("Français")}</option></Select></Field>
      </section>
      <section>
        <h2 className="mb-1 text-[13px] font-semibold"><Tr>Company details</Tr></h2>
        <p className="mb-4 text-xs text-muted"><Tr>Used as seller information on invoices. Issued invoices keep the details that existed when they were sent.</Tr></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name" name="companyLegalName" optional><Input name="companyLegalName" defaultValue={company.companyLegalName ?? ""} /></Field>
          <Field label="Billing email" name="companyEmail" optional><Input name="companyEmail" type="email" defaultValue={company.companyEmail ?? ""} /></Field>
          <Field label="Address" name="companyAddress" optional className="sm:col-span-2"><Textarea name="companyAddress" rows={3} defaultValue={company.companyAddress ?? ""} /></Field>
          <Field label="Country" name="companyCountry" optional><Input name="companyCountry" defaultValue={company.companyCountry ?? ""} /></Field>
          <Field label="Phone" name="companyPhone" optional><Input name="companyPhone" defaultValue={company.companyPhone ?? ""} /></Field>
          <Field label="VAT number" name="companyVatNumber" optional><Input name="companyVatNumber" defaultValue={company.companyVatNumber ?? ""} /></Field>
          <Field label="Company registration" name="companyRegistration" optional><Input name="companyRegistration" defaultValue={company.companyRegistration ?? ""} /></Field>
        </div>
      </section>
      <div className="flex justify-end"><Submit><Tr>Save settings</Tr></Submit></div>
    </Form>
  );
}

type LogoKind = "logo" | "portalLogo" | "invoiceLogo";

/** Upload (or remove) one logo image. The file is sent as soon as it is picked. */
function LogoUpload({ kind, label, hint, url, disabled, accept = "image/png,image/jpeg,image/webp" }: { kind: LogoKind; label: string; hint: string; url: string | null; disabled?: boolean; accept?: string }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  const input = useRef<HTMLInputElement>(null);
  const pick = (f: File | undefined) => {
    if (!f) return;
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", f);
    run(() => uploadLogoAction(fd));
    if (input.current) input.current.value = "";
  };
  return (
    <div className={cn("flex items-center gap-4", disabled && "opacity-50")}>
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-[repeating-conic-gradient(#8881_0_25%,transparent_0_50%)] bg-[length:12px_12px]">
        {url ? <img src={url} alt="" className="max-h-14 max-w-14 object-contain" /> : <ImageIcon className="size-5 text-muted" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{t(label)}</div>
        <p className="text-xs text-muted">{t(hint)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <Button type="button" size="sm" variant="secondary" disabled={disabled || pending} onClick={() => input.current?.click()}>
            <Upload className="size-3.5" /> {pending ? t("Uploading…") : url ? t("Replace") : t("Upload an image")}
          </Button>
          {url && <Button type="button" size="sm" variant="ghost" disabled={disabled || pending} onClick={() => run(() => removeLogoAction(kind))}><Trash2 className="size-3.5" /> {t("Remove")}</Button>}
        </div>
      </div>
    </div>
  );
}

export function BrandingForm({ logoUrl, portalLogoUrl, invoiceLogoUrl, canCustom }: { logoUrl: string | null; portalLogoUrl: string | null; invoiceLogoUrl: string | null; canCustom: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <LogoUpload kind="logo" label="Company logo" hint="PNG, JPG or WebP, 1 MB max. Shown in your workspace, portal and emails." url={logoUrl} />
        <LogoUpload kind="portalLogo" label="Client portal logo" hint={canCustom ? "Overrides the company logo in the client portal." : "Available on plans with custom branding."} url={portalLogoUrl} disabled={!canCustom} />
        <LogoUpload kind="invoiceLogo" label="Invoice logo" hint={canCustom ? "PNG or JPG, used on invoice PDFs." : "Available on plans with custom branding."} url={invoiceLogoUrl} disabled={!canCustom} accept="image/png,image/jpeg" />
      </div>
      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-[13px] font-medium">{t("Or use an image URL")}</summary>
        <Form action={updateBrandingAction} className="mt-4 space-y-5">
          <Field label="Company logo URL" name="logoUrl" optional hint="HTTPS image (PNG or JPG recommended). Shown in your workspace, portal and emails."><Input name="logoUrl" type="url" defaultValue={logoUrl ?? ""} placeholder="https://…/logo.png" /></Field>
          <fieldset disabled={!canCustom} className="space-y-5 disabled:opacity-50">
            <Field label="Client portal logo" name="portalLogoUrl" optional hint={canCustom ? t("Overrides the company logo in the client portal.") : t("Available on plans with custom branding.")}><Input name="portalLogoUrl" type="url" defaultValue={portalLogoUrl ?? ""} /></Field>
            <Field label="Invoice logo" name="invoiceLogoUrl" optional hint="PNG or JPG, used on invoice PDFs."><Input name="invoiceLogoUrl" type="url" defaultValue={invoiceLogoUrl ?? ""} /></Field>
          </fieldset>
          <div className="flex justify-end"><Submit><Tr>Save branding</Tr></Submit></div>
        </Form>
      </details>
    </div>
  );
}

type InvS = { prefix: string; includeYear: boolean; nextNumber: number; padding: number; defaultDueDays: number; defaultTaxRateBps: number; defaultCurrency: string; defaultNotes: string | null; defaultTerms: string | null; footer: string | null; bankDetails: string | null; remindersEnabled: boolean; reminderOffsets: number[] };
const OFFSETS = [[-3, "3 days before due date"], [0, "On due date"], [3, "3 days overdue"], [7, "7 days overdue"], [14, "14 days overdue"], [30, "30 days overdue"]] as const;

export function InvoiceSettingsForm({ s }: { s: InvS }) {
  const { t } = useI18n();
  const [prefix, setPrefix] = useState(s.prefix);
  const [year, setYear] = useState(s.includeYear);
  const [next, setNext] = useState(s.nextNumber);
  const [pad, setPad] = useState(s.padding);
  return (
    <Form action={saveInvoiceSettingsAction} className="space-y-8">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold"><Tr>Numbering</Tr></h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Prefix" name="prefix"><Input name="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} /></Field>
          <Field label="Starting number" name="nextNumber"><Input name="nextNumber" type="number" min={1} value={next} onChange={(e) => setNext(Number(e.target.value))} /></Field>
          <Field label="Digits" name="padding"><Input name="padding" type="number" min={1} max={8} value={pad} onChange={(e) => setPad(Number(e.target.value))} /></Field>
          <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includeYear" checked={year} onChange={(e) => setYear(e.target.checked)} className="accent-[#4d7cfe]" /><Tr>Include year</Tr></label></div>
        </div>
        <p className="mt-2 text-xs text-muted"><Tr>Next invoice:</Tr> <span className="num text-fg">{formatInvoiceNumber(prefix, year, new Date().getFullYear(), next || 1, pad || 4)}</span> <Tr>(or the next free number). Numbers are allocated transactionally and never duplicated.</Tr></p>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Payment terms (days)" name="defaultDueDays"><Input name="defaultDueDays" type="number" min={0} max={365} defaultValue={s.defaultDueDays} /></Field>
        <Field label="Default tax rate (%)" name="defaultTaxRate"><Input name="defaultTaxRate" inputMode="decimal" defaultValue={s.defaultTaxRateBps / 100} /></Field>
        <Field label="Default currency" name="defaultCurrency"><CurrencySelect name="defaultCurrency" value={s.defaultCurrency} /></Field>
        <Field label="Default notes" name="defaultNotes" optional className="sm:col-span-3"><Textarea name="defaultNotes" rows={2} defaultValue={s.defaultNotes ?? ""} /></Field>
        <Field label="Default payment terms text" name="defaultTerms" optional className="sm:col-span-3"><Textarea name="defaultTerms" rows={2} defaultValue={s.defaultTerms ?? ""} /></Field>
        <Field label="Bank details" name="bankDetails" optional className="sm:col-span-3" hint="Printed on invoices for bank transfers (IBAN, BIC…)."><Textarea name="bankDetails" rows={3} defaultValue={s.bankDetails ?? ""} /></Field>
        <Field label="Footer / legal mentions" name="footer" optional className="sm:col-span-3"><Input name="footer" defaultValue={s.footer ?? ""} /></Field>
      </section>
      <section>
        <h2 className="mb-1 text-[13px] font-semibold"><Tr>Automatic reminders</Tr></h2>
        <p className="mb-3 text-xs text-muted"><Tr>Sent daily to the client&apos;s billing email for unpaid invoices. Each reminder is sent at most once.</Tr></p>
        <Checkbox name="remindersEnabled" label="Enable automatic payment reminders" defaultChecked={s.remindersEnabled} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {OFFSETS.map(([o, label]) => <label key={o} className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="reminderOffsets" value={o} defaultChecked={s.reminderOffsets.includes(o)} className="accent-[#4d7cfe]" />{t(label)}</label>)}
        </div>
      </section>
      <div className="flex justify-end"><Submit><Tr>Save invoice settings</Tr></Submit></div>
    </Form>
  );
}

export function StripeConnectPanel({ state, configured, allowed }: { state: null | { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }; configured: boolean; allowed: boolean }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  const go = (fn: () => Promise<{ ok: boolean; data?: unknown }>) => run(fn as never, undefined, (d) => { const url = (d as { url?: string })?.url; if (url) window.location.href = url; });
  if (!configured) return <p className="rounded-xl border border-line p-4 text-sm text-muted"><Tr>Online payments aren&apos;t configured on this platform yet. You can still record manual payments (bank transfer, cash, check).</Tr></p>;
  if (!allowed) return <p className="rounded-xl border border-line p-4 text-sm text-muted"><Tr>Online payments aren&apos;t included in your plan.</Tr></p>;
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium"><Tr>Stripe</Tr></div>
          <p className="mt-1 text-xs text-muted">{state?.chargesEnabled ? t("Your clients can pay invoices by card. Money goes directly to your Stripe account.") : state ? t("Finish your Stripe onboarding to accept card payments.") : t("Connect your own Stripe account to get paid by card directly.")}</p>
        </div>
        <div className="flex gap-2">
          {state && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => syncStripeAccountAction())}><Tr>Refresh status</Tr></Button>}
          {state?.chargesEnabled ? <Button size="sm" disabled={pending} onClick={() => go(() => stripeDashboardLinkAction())}><Tr>Open Stripe dashboard</Tr></Button> : <Button size="sm" variant="primary" disabled={pending} onClick={() => go(() => connectStripeAction())}>{state ? t("Continue onboarding") : t("Connect Stripe")}</Button>}
        </div>
      </div>
      {state && (
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs">
          <div><dt className="text-muted"><Tr>Details submitted</Tr></dt><dd className={state.detailsSubmitted ? "text-success" : "text-warning"}>{state.detailsSubmitted ? t("Yes") : t("No")}</dd></div>
          <div><dt className="text-muted"><Tr>Card payments</Tr></dt><dd className={state.chargesEnabled ? "text-success" : "text-warning"}>{state.chargesEnabled ? t("Enabled") : t("Pending")}</dd></div>
          <div><dt className="text-muted"><Tr>Payouts</Tr></dt><dd className={state.payoutsEnabled ? "text-success" : "text-warning"}>{state.payoutsEnabled ? t("Enabled") : t("Pending")}</dd></div>
        </dl>
      )}
    </div>
  );
}

export type PlanOption = { code: string; name: string; description: string | null; monthly: number; annual: number | null; currency: string; highlight: boolean; features: string[] };

export function PlanPicker({ plans, currentCode, configured, hasSubscription, hasBillingAccount }: { plans: PlanOption[]; currentCode: string; configured: boolean; hasSubscription: boolean; hasBillingAccount: boolean }) {
  const { t, fmt } = useI18n();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const { pending, run } = useActionButton();
  const go = (fn: () => Promise<{ ok: boolean }>) => run(fn as never, undefined, (d) => { const url = (d as { url?: string })?.url; if (url) window.location.href = url; });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label={t("Billing interval")}>
          {(["month", "year"] as const).map((i) => <button key={i} role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={cn("rounded-md px-3 py-1", interval === i ? "bg-white/[0.08] text-fg" : "text-muted")}>{i === "month" ? t("Monthly") : t("Yearly")}</button>)}
        </div>
        {hasBillingAccount && configured && <Button size="sm" variant="ghost" disabled={pending} onClick={() => go(() => openBillingPortalAction())}><Tr>Manage payment & subscription</Tr></Button>}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const price = interval === "month" ? p.monthly : p.annual;
          const current = p.code === currentCode;
          return (
            <div key={p.code} className={cn("panel flex flex-col rounded-2xl p-5", current && "border-accent/50 ring-1 ring-accent/30")}>
              <div className="flex items-center justify-between"><span className="font-medium">{p.name}</span>{current && <span className="text-[11px] text-accent"><Tr>Current</Tr></span>}</div>
              <div className="num mt-3 text-2xl font-semibold">{price === null ? "—" : fmt.money(price, p.currency)}<span className="text-xs font-normal text-muted">/{interval === "month" ? t("mo") : t("yr")}</span></div>
              <p className="mt-2 flex-1 text-xs text-muted">{p.description}</p>
              <Button className="mt-4" size="sm" variant={p.highlight ? "primary" : "secondary"} disabled={pending || !configured || price === null} onClick={() => go(() => startSubscriptionCheckoutAction(p.code, interval))}>
                {current ? (hasSubscription ? t("Switch interval") : t("Subscribe")) : t("Choose {plan}", { plan: p.name })}
              </Button>
            </div>
          );
        })}
      </div>
      {!configured && <p className="mt-3 text-xs text-warning"><Tr>Subscription payments aren&apos;t configured on this platform yet.</Tr></p>}
    </div>
  );
}

export function DrivePanel({ state, configured, allowed }: { state: null | { status: string; accountEmail: string | null; lastError: string | null; folderName?: string | null }; configured: boolean; allowed: boolean }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  if (!configured) return <p className="text-sm text-muted"><Tr>Google Drive isn&apos;t configured on this platform yet.</Tr></p>;
  if (!allowed) return <p className="text-sm text-muted"><Tr>Google Drive integration isn&apos;t included in your plan.</Tr></p>;
  const connected = state?.status === "CONNECTED";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {connected ? <><Tr>Connected as</Tr> <span className="text-fg">{state.accountEmail ?? t("Google account")}</span></> : state ? <span className="text-warning"><Tr>Disconnected</Tr>{state.lastError ? ` — ${state.lastError}` : ""}</span> : t("Not connected")}
          <p className="mt-0.5 text-xs text-muted"><Tr>Link Drive files to projects without copying them. They don&apos;t count toward your storage.</Tr></p>
        </div>
        {connected ? <Button size="sm" disabled={pending} onClick={() => confirm(t("Disconnect Google Drive? Linked files remain listed.")) && run(() => disconnectDriveAction())}><Tr>Disconnect</Tr></Button> : <a href="/api/integrations/google/connect" className="inline-flex h-8 items-center rounded-[10px] bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-hover">{state ? t("Reconnect") : t("Connect")}</a>}
      </div>
      {connected && (
        <Form action={setDriveFolderAction} className="flex flex-wrap items-end gap-2">
          <Field label="Default folder" name="folder" optional className="min-w-64 flex-1" hint={state.folderName ? `Current: ${state.folderName}` : undefined}><Input name="folder" placeholder="https://drive.google.com/drive/folders/…" /></Field>
          <Submit variant="secondary"><Tr>Save</Tr></Submit>
        </Form>
      )}
    </div>
  );
}
