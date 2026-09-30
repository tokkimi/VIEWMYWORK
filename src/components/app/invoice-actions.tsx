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
  const { pending, run } = useActionButton();
  return (
    <Button size={size} variant="secondary" disabled={pending} onClick={() => run(() => sendReminderAction(invoiceId))}>
      <Bell className="size-3.5" /> {pending ? "Sending…" : "Send reminder"}
    </Button>
  );
}

export function SendInvoiceDialog({ invoice, defaultTo, workspaceName, userEmail }: { invoice: { id: string; number: string | null; status: string }; defaultTo: string; workspaceName: string; userEmail: string }) {
  const toast = useToast();
  const [result, setResult] = useState<{ number: string; emailStatus: string; emailError?: string } | null>(null);
  const isDraft = invoice.status === "DRAFT";
  return (
    <Dialog
      title={isDraft ? "Send invoice" : "Resend invoice"}
      description={isDraft ? "The invoice is numbered, frozen and emailed with its PDF. It also appears in the client portal." : "Email this invoice again."}
      trigger={(open) => (
        <Button variant="primary" onClick={() => { setResult(null); open(); }}>
          <Send className="size-4" /> {isDraft ? "Send invoice" : "Resend"}
        </Button>
      )}
    >
      {(close) =>
        result ? (
          <div className="space-y-4 text-sm">
            {result.emailStatus === "SENT" ? (
              <p>Invoice <strong>{result.number}</strong> was emailed and is available in the client portal.</p>
            ) : result.emailStatus === "NOT_CONFIGURED" ? (
              <p className="rounded-lg bg-warning-soft p-3 text-warning">Invoice <strong>{result.number}</strong> was issued and is visible in the client portal, but <strong>no email was sent</strong> because email delivery isn&apos;t configured on this platform yet.</p>
            ) : (
              <p className="rounded-lg bg-danger-soft p-3 text-danger">Invoice <strong>{result.number}</strong> was issued, but the email failed: {result.emailError}. It&apos;s still available in the client portal.</p>
            )}
            <div className="flex justify-end"><Button onClick={close}>Close</Button></div>
          </div>
        ) : (
          <Form
            action={sendInvoiceAction}
            onSuccess={(d) => {
              const r = d as { number: string; emailStatus: string; emailError?: string };
              setResult(r);
              if (r.emailStatus === "SENT") toast.success(`Invoice ${r.number} sent.`);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={invoice.id} />
            <Field label="To" name="to"><Input name="to" type="email" defaultValue={defaultTo} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CC" name="cc" optional><Input name="cc" placeholder="a@b.com, c@d.com" /></Field>
              <Field label="BCC" name="bcc" optional><Input name="bcc" /></Field>
            </div>
            <Field label="Subject" name="subject"><Input name="subject" defaultValue={`Invoice ${invoice.number ?? ""} from ${workspaceName}`.replace("  ", " ")} required /></Field>
            <Field label="Message" name="message" optional><Textarea name="message" rows={4} defaultValue={"Hello,\n\nPlease find your invoice attached. You can view and pay it online using the button below.\n\nThank you!"} /></Field>
            <Checkbox name="sendCopy" label={`Send me a copy (${userEmail})`} />
            <p className="text-xs text-subtle">The invoice PDF is attached automatically.</p>
            <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit pendingLabel="Sending…">Send</Submit></div>
          </Form>
        )
      }
    </Dialog>
  );
}

export function RecordPaymentDialog({ invoiceId, outstanding }: { invoiceId: string; outstanding: string }) {
  return (
    <Dialog title="Record manual payment" description="For payments received outside the platform (bank transfer, cash, check…)." trigger={(open) => <Button onClick={open}><Wallet className="size-4" /> Record payment</Button>}>
      {(close) => (
        <Form action={recordManualPaymentAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" name="amount" hint={`Outstanding: ${outstanding}`}><Input name="amount" inputMode="decimal" required /></Field>
            <Field label="Date" name="date"><Input name="date" type="date" defaultValue={toDateInput(new Date())} required /></Field>
            <Field label="Method" name="method">
              <Select name="method" defaultValue="BANK_TRANSFER">
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHECK">Check</option>
                <option value="CARD">Card (external terminal)</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Reference" name="reference" optional><Input name="reference" /></Field>
          </div>
          <Field label="Notes" name="notes" optional><Textarea name="notes" rows={2} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Record payment</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function EditIssuedDialog({ id, dueDate, notes }: { id: string; dueDate: Date; notes: string | null }) {
  return (
    <Dialog title="Update invoice" description="Issued invoices are frozen financial documents. Only the due date and notes can change." trigger={(open) => <Button size="sm" onClick={open}>Update due date</Button>}>
      {(close) => (
        <Form action={updateIssuedInvoiceAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <Field label="Due date" name="dueDate"><Input name="dueDate" type="date" defaultValue={toDateInput(dueDate)} required /></Field>
          <Field label="Notes" name="notes" optional><Textarea name="notes" defaultValue={notes ?? ""} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Save</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function InvoiceMoreActions({ id, status, canVoid }: { id: string; status: string; canVoid: boolean }) {
  const { pending, run } = useActionButton();
  return (
    <>
      <Button variant="ghost" disabled={pending} onClick={() => run(() => duplicateInvoiceAction(id))}><Copy className="size-4" /> Duplicate</Button>
      {status === "DRAFT" && (
        <Button variant="ghost" disabled={pending} onClick={() => confirm("Delete this draft?") && run(() => deleteDraftInvoiceAction(id))}><Trash2 className="size-4" /> Delete</Button>
      )}
      {canVoid && (
        <Button variant="ghost" disabled={pending} onClick={() => confirm("Void this invoice? The client will be notified that it was cancelled.") && run(() => voidInvoiceAction(id))}><Ban className="size-4" /> Void</Button>
      )}
    </>
  );
}
