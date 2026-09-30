"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Bell, Ban, Copy, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Textarea, Select, Submit, Checkbox } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { sendInvoiceAction, sendReminderAction, voidInvoiceAction, duplicateInvoiceAction, deleteDraftInvoiceAction, recordManualPaymentAction, updateIssuedInvoiceAction } from "@/server/actions/invoices";
import type { ActionResult } from "@/lib/errors";
import { toDateInput } from "@/lib/format";
import { Tr, useI18n } from "@/lib/i18n/client";
import { translate, type Locale, type Vars } from "@/lib/i18n/core";

export function useActionButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<ActionResult<unknown>>, success?: string, onOk?: (d: unknown) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast.error(r.error);
      if (success || r.message) toast.success(r.message ?? success!);
      const redirect = (r.data as { redirect?: string } | null)?.redirect;
      if (onOk) onOk(r.data);
      if (redirect) router.push(redirect);
      else router.refresh();
    });
  return { pending, run };
}

export function SendReminderButton({ invoiceId, size = "md" }: { invoiceId: string; size?: "sm" | "md" }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <Button size={size} variant="secondary" disabled={pending} onClick={() => run(() => sendReminderAction(invoiceId))}>
      <Bell className="size-3.5" /> {pending ? t("Sending…") : t("Send reminder")}
    </Button>
  );
}

export function SendInvoiceDialog({ invoice, defaultTo, workspaceName, userEmail, clientLocale }: { invoice: { id: string; number: string | null; status: string }; defaultTo: string; workspaceName: string; userEmail: string; clientLocale: Locale }) {
  const { t } = useI18n();
  // The email goes to the client: its default subject and message use the client's language.
  const tc = (k: string, v?: Vars) => translate(clientLocale, k, v);
  const toast = useToast();
  const [result, setResult] = useState<{ number: string; emailStatus: string; emailError?: string } | null>(null);
  const isDraft = invoice.status === "DRAFT";
  return (
    <Dialog
      title={isDraft ? t("Send invoice") : t("Resend invoice")}
      description={isDraft ? t("The invoice is numbered, frozen and emailed with its PDF. It also appears in the client portal.") : t("Email this invoice again.")}
      trigger={(open) => (
        <Button variant="primary" onClick={() => { setResult(null); open(); }}>
          <Send className="size-4" /> {isDraft ? t("Send invoice") : t("Resend")}
        </Button>
      )}
    >
      {(close) =>
        result ? (
          <div className="space-y-4 text-sm">
            {result.emailStatus === "SENT" ? (
              <p><Tr>Invoice</Tr> <strong>{result.number}</strong> <Tr>was emailed and is available in the client portal.</Tr></p>
            ) : result.emailStatus === "NOT_CONFIGURED" ? (
              <p className="rounded-lg bg-warning-soft p-3 text-warning"><Tr>Invoice</Tr> <strong>{result.number}</strong> <Tr>was issued and is visible in the client portal, but</Tr> <strong><Tr>no email was sent</Tr></strong> <Tr>because email delivery isn&apos;t configured on this platform yet.</Tr></p>
            ) : (
              <p className="rounded-lg bg-danger-soft p-3 text-danger"><Tr>Invoice</Tr> <strong>{result.number}</strong> <Tr>was issued, but the email failed:</Tr> {result.emailError}<Tr>. It&apos;s still available in the client portal.</Tr></p>
            )}
            <div className="flex justify-end"><Button onClick={close}><Tr>Close</Tr></Button></div>
          </div>
        ) : (
          <Form
            action={sendInvoiceAction}
            onSuccess={(d) => {
              const r = d as { number: string; emailStatus: string; emailError?: string };
              setResult(r);
              if (r.emailStatus === "SENT") toast.success(t("Invoice {number} sent.", { number: r.number }));
            }}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={invoice.id} />
            <Field label="To" name="to"><Input name="to" type="email" defaultValue={defaultTo} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CC" name="cc" optional><Input name="cc" placeholder="a@b.com, c@d.com" /></Field>
              <Field label="BCC" name="bcc" optional><Input name="bcc" /></Field>
            </div>
            <Field label="Subject" name="subject"><Input name="subject" defaultValue={tc("Invoice {number} from {workspace}", { number: invoice.number ?? "", workspace: workspaceName }).replace("  ", " ")} required /></Field>
            <Field label="Message" name="message" optional><Textarea name="message" rows={4} defaultValue={tc("Hello,\n\nPlease find your invoice attached. You can view and pay it online using the button below.\n\nThank you!")} /></Field>
            <Checkbox name="sendCopy" label={t("Send me a copy ({email})", { email: userEmail })} />
            <p className="text-xs text-subtle"><Tr>The invoice PDF is attached automatically.</Tr></p>
            <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit pendingLabel="Sending…"><Tr>Send</Tr></Submit></div>
          </Form>
        )
      }
    </Dialog>
  );
}

export function RecordPaymentDialog({ invoiceId, outstanding }: { invoiceId: string; outstanding: string }) {
  const { t } = useI18n();
  return (
    <Dialog title="Record manual payment" description="For payments received outside the platform (bank transfer, cash, check…)." trigger={(open) => <Button onClick={open}><Wallet className="size-4" /> <Tr>Record payment</Tr></Button>}>
      {(close) => (
        <Form action={recordManualPaymentAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" name="amount" hint={t("Outstanding: {amount}", { amount: outstanding })}><Input name="amount" inputMode="decimal" required /></Field>
            <Field label="Date" name="date"><Input name="date" type="date" defaultValue={toDateInput(new Date())} required /></Field>
            <Field label="Method" name="method">
              <Select name="method" defaultValue="BANK_TRANSFER">
                <option value="BANK_TRANSFER">{t("Bank transfer")}</option>
                <option value="CASH">{t("Cash")}</option>
                <option value="CHECK">{t("Check")}</option>
                <option value="CARD">{t("Card (external terminal)")}</option>
                <option value="OTHER">{t("Other")}</option>
              </Select>
            </Field>
            <Field label="Reference" name="reference" optional><Input name="reference" /></Field>
          </div>
          <Field label="Notes" name="notes" optional><Textarea name="notes" rows={2} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Record payment</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function EditIssuedDialog({ id, dueDate, notes }: { id: string; dueDate: Date; notes: string | null }) {
  return (
    <Dialog title="Update invoice" description="Issued invoices are frozen financial documents. Only the due date and notes can change." trigger={(open) => <Button size="sm" onClick={open}><Tr>Update due date</Tr></Button>}>
      {(close) => (
        <Form action={updateIssuedInvoiceAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <Field label="Due date" name="dueDate"><Input name="dueDate" type="date" defaultValue={toDateInput(dueDate)} required /></Field>
          <Field label="Notes" name="notes" optional><Textarea name="notes" defaultValue={notes ?? ""} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Save</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function InvoiceMoreActions({ id, status, canVoid }: { id: string; status: string; canVoid: boolean }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <>
      <Button variant="ghost" disabled={pending} onClick={() => run(() => duplicateInvoiceAction(id))}><Copy className="size-4" /> <Tr>Duplicate</Tr></Button>
      {status === "DRAFT" && (
        <Button variant="ghost" disabled={pending} onClick={() => confirm(t("Delete this draft?")) && run(() => deleteDraftInvoiceAction(id))}><Trash2 className="size-4" /> <Tr>Delete</Tr></Button>
      )}
      {canVoid && (
        <Button variant="ghost" disabled={pending} onClick={() => confirm(t("Void this invoice? The client will be notified that it was cancelled.")) && run(() => voidInvoiceAction(id))}><Ban className="size-4" /> <Tr>Void</Tr></Button>
      )}
    </>
  );
}
