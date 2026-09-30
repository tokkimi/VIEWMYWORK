"use client";

import { useState } from "react";
import { Plus, Trash2, Copy, Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Submit, Textarea, inputClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useActionButton } from "./invoice-actions";
import { saveTemplateAction, duplicateTemplateAction, deleteTemplateAction } from "@/server/actions/templates";

type Tpl = { id?: string; name: string; category: string; description?: string | null; phases: { title: string; weight: number; tasks: string[] }[] };

export function TemplateEditorDialog({ tpl, trigger }: { tpl?: Tpl; trigger: "new" | "edit" }) {
  const [phases, setPhases] = useState(tpl?.phases ?? [{ title: "Discovery", weight: 10, tasks: [] as string[] }]);
  const [meta, setMeta] = useState({ name: tpl?.name ?? "", category: tpl?.category ?? "Custom", description: tpl?.description ?? "" });
  const payload = JSON.stringify({ id: tpl?.id, ...meta, phases });
  return (
    <Dialog size="lg" title={tpl ? "Edit template" : "New template"} trigger={(open) => (trigger === "new" ? <Button variant="primary" onClick={open}><Plus className="size-4" />New template</Button> : <button onClick={open} aria-label="Edit template" className="rounded p-1.5 text-muted hover:text-fg"><Pencil className="size-3.5" /></button>)}>
      {(close) => (
        <Form action={saveTemplateAction} onSuccess={close} className="space-y-5">
          <input type="hidden" name="payload" value={payload} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name"><Input name="name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} required /></Field>
            <Field label="Category" name="category"><Input name="category" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} /></Field>
            <Field label="Description" name="description" optional className="sm:col-span-2"><Input name="description" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
          </div>
          <div className="space-y-3">
            {phases.map((p, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <div className="flex gap-2">
                  <input aria-label="Phase title" value={p.title} onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={`${inputClass} flex-1`} placeholder="Phase title" />
                  <input aria-label="Phase weight" type="number" min={0} value={p.weight} onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} className={`${inputClass} w-20`} />
                  <button type="button" aria-label="Remove phase" onClick={() => setPhases(phases.filter((_, j) => j !== i))} className="rounded p-2 text-subtle hover:text-danger"><Trash2 className="size-4" /></button>
                </div>
                <Textarea aria-label="Tasks, one per line" rows={3} className="mt-2" value={p.tasks.join("\n")} onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, tasks: e.target.value.split("\n").map((t) => t.trimStart()).filter((t, k, arr) => t || k < arr.length - 1) } : x)))} placeholder="One task per line" />
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setPhases([...phases, { title: "", weight: 10, tasks: [] }])}><Plus className="size-3.5" />Add phase</Button>
          </div>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Save template</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function TemplateRowActions({ id, own }: { id: string; own: boolean }) {
  const { pending, run } = useActionButton();
  return (
    <>
      <button aria-label="Duplicate template" disabled={pending} onClick={() => run(() => duplicateTemplateAction(id))} className="rounded p-1.5 text-muted hover:text-fg"><Copy className="size-3.5" /></button>
      {own && <button aria-label="Delete template" disabled={pending} onClick={() => confirm("Delete this template? Existing projects are not affected.") && run(() => deleteTemplateAction(id))} className="rounded p-1.5 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>}
    </>
  );
}
