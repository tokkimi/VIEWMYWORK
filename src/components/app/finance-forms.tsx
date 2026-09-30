"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Select, Textarea, Submit } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CurrencySelect } from "./entity-fields";
import { useActionButton } from "./invoice-actions";
import { saveExpenseAction, deleteExpenseAction } from "@/server/actions/finance";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { centsToInput } from "@/lib/money";
import { toDateInput } from "@/lib/format";

type Expense = { id: string; name: string; category: string; amountCents: number; taxCents: number; currency: string; date: Date | string; supplier: string | null; reference: string | null; notes: string | null; projectId: string | null };

export function ExpenseDialog({ projects, defaultProjectId, currency, expense, openInitially }: { projects: { id: string; name: string }[]; defaultProjectId?: string; currency: string; expense?: Expense; openInitially?: boolean }) {
  const [open, setOpen] = useState(Boolean(openInitially));
  const router = useRouter();
  const path = usePathname();
  const e = expense;
  return (
    <Dialog
      title={e ? "Edit expense" : "New expense"}
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o && openInitially) router.replace(path, { scroll: false }); }}
      trigger={(o) => (e ? <button onClick={o} aria-label="Edit expense" className="rounded p-1 text-subtle hover:text-fg"><Pencil className="size-3.5" /></button> : <Button size="sm" variant="primary" onClick={o}><Plus className="size-3.5" />Add expense</Button>)}
    >
      {(close) => (
        <Form action={saveExpenseAction} onSuccess={close} className="space-y-4">
          {e && <input type="hidden" name="id" value={e.id} />}
          <Field label="Name" name="name"><Input name="name" required defaultValue={e?.name} placeholder="Figma subscription" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" name="category"><Select name="category" defaultValue={e?.category ?? "SOFTWARE"}>{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Date" name="date"><Input name="date" type="date" required defaultValue={toDateInput(e?.date ?? new Date())} /></Field>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Field label="Amount" name="amount"><Input name="amount" inputMode="decimal" required defaultValue={e ? centsToInput(e.amountCents) : ""} /></Field>
              <Field label="Currency" name="currency"><CurrencySelect value={e?.currency ?? currency} /></Field>
            </div>
            <Field label="Of which tax" name="tax" optional><Input name="tax" inputMode="decimal" defaultValue={e?.taxCents ? centsToInput(e.taxCents) : ""} /></Field>
            <Field label="Supplier" name="supplier" optional><Input name="supplier" defaultValue={e?.supplier ?? ""} /></Field>
            <Field label="Reference" name="reference" optional><Input name="reference" defaultValue={e?.reference ?? ""} /></Field>
            <Field label="Project" name="projectId" optional className="sm:col-span-2"><Select name="projectId" defaultValue={e?.projectId ?? defaultProjectId ?? ""}><option value="">— No project —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          </div>
          <Field label="Notes" name="notes" optional><Textarea name="notes" rows={2} defaultValue={e?.notes ?? ""} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Save</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function DeleteExpenseButton({ id }: { id: string }) {
  const { pending, run } = useActionButton();
  return <button aria-label="Delete expense" disabled={pending} onClick={() => confirm("Delete this expense?") && run(() => deleteExpenseAction(id))} className="rounded p-1 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>;
}
