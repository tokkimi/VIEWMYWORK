"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Form, Field, Input, Select, Textarea, Submit, inputClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { saveInvoiceAction } from "@/server/actions/invoices";
import { calcInvoice } from "@/lib/invoices/calc";
import { formatMoneyExact, parseMoneyToCents, CURRENCIES } from "@/lib/money";
import { toDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";

type Line = { key: number; description: string; quantity: string; unitPrice: string; taxRate: string; discount: string };

export type EditorInitial = {
  id?: string;
  clientId?: string;
  projectId?: string | null;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  notes?: string | null;
  terms?: string | null;
  footer?: string | null;
  lines: { description: string; quantity: number; unitPrice: string; taxRate: number; discount: number }[];
};

export function InvoiceEditor({ initial, clients, projects, numberPreview }: { initial: EditorInitial; clients: { id: string; name: string; currency: string }[]; projects: { id: string; name: string; clientId: string }[]; numberPreview: string }) {
  const [clientId, setClientId] = useState(initial.clientId ?? clients[0]?.id ?? "");
  const [currency, setCurrency] = useState(initial.currency);
  const [lines, setLines] = useState<Line[]>(initial.lines.map((l, i) => ({ key: i, description: l.description, quantity: String(l.quantity), unitPrice: l.unitPrice, taxRate: String(l.taxRate), discount: String(l.discount) })));
  const [showDiscount, setShowDiscount] = useState(initial.lines.some((l) => l.discount > 0));
  const nextKey = () => Math.max(0, ...lines.map((l) => l.key)) + 1;
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const clientProjects = projects.filter((p) => p.clientId === clientId);

  // Live preview only — the server recomputes authoritative totals from the line items.
  const totals = useMemo(
    () =>
      calcInvoice(
        lines.map((l) => ({ description: l.description, quantity: Number(l.quantity.replace(",", ".")) || 0, unitPriceCents: parseMoneyToCents(l.unitPrice) ?? 0, taxRateBps: Math.round((Number(l.taxRate.replace(",", ".")) || 0) * 100), discountBps: Math.round((Number(l.discount.replace(",", ".")) || 0) * 100) })),
      ),
    [lines],
  );
  const payload = JSON.stringify(lines.map((l) => ({ description: l.description, quantity: l.quantity.replace(",", ".") || "0", unitPrice: l.unitPrice || "0", taxRate: l.taxRate.replace(",", ".") || "0", discount: l.discount.replace(",", ".") || "0" })));
  const m = (c: number) => formatMoneyExact(c, currency);

  return (
    <Form action={saveInvoiceAction} redirectTo={(d) => (d as { redirect?: string }).redirect} className="space-y-8">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="lines" value={payload} />
      <div className="panel grid gap-4 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Client" name="clientId" className="lg:col-span-2">
          <Select
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              const c = clients.find((x) => x.id === e.target.value);
              if (c && !initial.id) setCurrency(c.currency);
            }}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Project" name="projectId" optional className="lg:col-span-2">
          <Select name="projectId" defaultValue={initial.projectId ?? ""} key={clientId}>
            <option value="">—</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice number" name="number" hint="Assigned automatically when the invoice is sent."><Input name="number" value={numberPreview} disabled readOnly /></Field>
        <Field label="Issue date" name="issueDate"><Input name="issueDate" type="date" defaultValue={toDateInput(initial.issueDate)} required /></Field>
        <Field label="Due date" name="dueDate"><Input name="dueDate" type="date" defaultValue={toDateInput(initial.dueDate)} required /></Field>
        <Field label="Currency" name="currency">
          <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">Line items</h2>
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} className="accent-[#4d7cfe]" /> Discounts</label>
        </div>
        <div className="panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-subtle">
                <th className="w-6" />
                <th className="px-2 py-2.5 font-medium">Description</th>
                <th className="w-24 px-2 py-2.5 text-right font-medium">Qty</th>
                <th className="w-32 px-2 py-2.5 text-right font-medium">Unit price</th>
                <th className="w-20 px-2 py-2.5 text-right font-medium">Tax %</th>
                {showDiscount && <th className="w-20 px-2 py-2.5 text-right font-medium">Disc. %</th>}
                <th className="w-32 px-2 py-2.5 text-right font-medium">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.key} className="border-t border-line align-top">
                  <td className="pl-2 pt-3 text-subtle"><GripVertical className="size-4" aria-hidden /></td>
                  <td className="p-2"><textarea aria-label={`Line ${idx + 1} description`} rows={1} value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} className={cn(inputClass, "h-auto min-h-9 resize-y py-2")} placeholder="Design — homepage" /></td>
                  <td className="p-2"><input aria-label={`Line ${idx + 1} quantity`} inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} className={cn(inputClass, "num text-right")} /></td>
                  <td className="p-2"><input aria-label={`Line ${idx + 1} unit price`} inputMode="decimal" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className={cn(inputClass, "num text-right")} placeholder="0.00" /></td>
                  <td className="p-2"><input aria-label={`Line ${idx + 1} tax rate`} inputMode="decimal" value={l.taxRate} onChange={(e) => update(l.key, { taxRate: e.target.value })} className={cn(inputClass, "num text-right")} /></td>
                  {showDiscount && <td className="p-2"><input aria-label={`Line ${idx + 1} discount`} inputMode="decimal" value={l.discount} onChange={(e) => update(l.key, { discount: e.target.value })} className={cn(inputClass, "num text-right")} /></td>}
                  <td className="num p-2 pt-4 text-right">{m(totals.lines[idx]?.lineSubtotal ?? 0)}</td>
                  <td className="p-2 pt-2.5">
                    <button type="button" aria-label={`Remove line ${idx + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded-md p-1.5 text-subtle hover:bg-white/5 hover:text-danger disabled:opacity-30"><Trash2 className="size-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line p-2">
            <Button size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, { key: nextKey(), description: "", quantity: "1", unitPrice: "", taxRate: ls[ls.length - 1]?.taxRate ?? "0", discount: "0" }])}><Plus className="size-3.5" /> Add line</Button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            {totals.discountCents > 0 && <div className="flex justify-between text-muted"><dt>Discount</dt><dd className="num">− {m(totals.discountCents)}</dd></div>}
            <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd className="num">{m(totals.subtotalCents)}</dd></div>
            {totals.taxBreakdown.map((t) => (
              <div key={t.rateBps} className="flex justify-between text-muted"><dt>Tax {t.rateBps / 100}%</dt><dd className="num">{m(t.amount)}</dd></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="num">{m(totals.totalCents)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Notes" name="notes" optional><Textarea name="notes" rows={3} defaultValue={initial.notes ?? ""} placeholder="Thank you for your business." /></Field>
        <Field label="Payment terms" name="terms" optional><Textarea name="terms" rows={3} defaultValue={initial.terms ?? ""} placeholder="Payment due within 30 days." /></Field>
        <Field label="Footer" name="footer" optional className="md:col-span-2"><Input name="footer" defaultValue={initial.footer ?? ""} placeholder="Legal mentions, late-payment penalties…" /></Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-line pt-6">
        <Submit size="lg">{initial.id ? "Save draft" : "Save as draft"}</Submit>
      </div>
    </Form>
  );
}
