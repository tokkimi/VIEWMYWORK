"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Send, Plus, Pencil, Trash2, Layers } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Textarea, Select, Submit, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useActionButton } from "./invoice-actions";
import { createDeliverableAction, updateDeliverableAction, newVersionAction, submitDeliverableAction, deleteDeliverableAction, updateVersionAction } from "@/server/actions/deliverables";
import { Tr, useI18n } from "@/lib/i18n/client";

export function NewDeliverableDialog({ projectId, phases, openInitially }: { projectId: string; phases: { id: string; title: string }[]; openInitially?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(Boolean(openInitially));
  const router = useRouter();
  const path = usePathname();
  return (
    <Dialog title="New deliverable" open={open} onOpenChange={(o) => { setOpen(o); if (!o && openInitially) router.replace(path, { scroll: false }); }} trigger={(o) => <Button variant="primary" onClick={o}><Plus className="size-4" /><Tr>New deliverable</Tr></Button>}>
      {(close) => (
        <Form action={createDeliverableAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Title" name="title"><Input name="title" required placeholder={t("Homepage design")} /></Field>
          <Field label="Description" name="description" optional><Textarea name="description" rows={3} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phase" name="phaseId" optional><Select name="phaseId" defaultValue=""><option value="">—</option>{phases.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
            <Field label="Preview URL" name="previewUrl" optional><Input name="previewUrl" type="url" placeholder="https://" /></Field>
          </div>
          <Checkbox name="requiresApproval" label="Require client approval" description="The client will Approve or Request changes." defaultChecked />
          <Checkbox name="internal" label="Internal (hidden from client)" />
          <p className="text-xs text-subtle"><Tr>You can attach files after creating it.</Tr></p>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Create</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

type D = { id: string; title: string; description: string | null; status: string; requiresApproval: boolean; internal: boolean; notes: string | null; previewUrl: string | null };

export function DeliverableActions({ d }: { d: D }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  const [edit, setEdit] = useState(false);
  const [version, setVersion] = useState(false);
  const locked = d.status === "APPROVED" || d.status === "WAITING_FOR_CLIENT";
  return (
    <div className="flex flex-wrap gap-2">
      {!locked && (
        <Button variant="primary" size="sm" disabled={pending} onClick={() => run(() => submitDeliverableAction(d.id))}>
          <Send className="size-3.5" />{d.requiresApproval ? t("Request approval") : t("Share with client")}
        </Button>
      )}
      {(d.status === "CHANGES_REQUESTED" || d.status === "APPROVED" || d.status === "READY_FOR_REVIEW") && <Button size="sm" onClick={() => setVersion(true)}><Layers className="size-3.5" /><Tr>New version</Tr></Button>}
      <Button size="sm" variant="ghost" onClick={() => setEdit(true)}><Pencil className="size-3.5" /><Tr>Edit</Tr></Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(t("Delete this deliverable?")) && run(() => deleteDeliverableAction(d.id))}><Trash2 className="size-3.5" /></Button>
      <Dialog title="Edit deliverable" open={edit} onOpenChange={setEdit}>
        {(close) => (
          <div className="space-y-6">
            <Form action={updateDeliverableAction} onSuccess={close} className="space-y-4">
              <input type="hidden" name="id" value={d.id} />
              <Field label="Title" name="title"><Input name="title" defaultValue={d.title} required /></Field>
              <Field label="Description" name="description" optional><Textarea name="description" defaultValue={d.description ?? ""} rows={3} /></Field>
              <Checkbox name="requiresApproval" label="Require client approval" defaultChecked={d.requiresApproval} />
              <Checkbox name="internal" label="Internal (hidden from client)" defaultChecked={d.internal} />
              <div className="flex justify-end"><Submit><Tr>Save</Tr></Submit></div>
            </Form>
            {!locked && (
              <Form action={updateVersionAction} onSuccess={close} className="space-y-4 border-t border-line pt-5">
                <input type="hidden" name="id" value={d.id} />
                <Field label="Current version notes" name="notes" optional><Textarea name="notes" defaultValue={d.notes ?? ""} rows={2} /></Field>
                <Field label="Preview URL" name="previewUrl" optional><Input name="previewUrl" type="url" defaultValue={d.previewUrl ?? ""} /></Field>
                <div className="flex justify-end"><Submit variant="secondary"><Tr>Save version</Tr></Submit></div>
              </Form>
            )}
          </div>
        )}
      </Dialog>
      <Dialog title="Start a new version" description="The previous version and its approval history are kept." open={version} onOpenChange={setVersion}>
        {(close) => (
          <Form action={newVersionAction} onSuccess={close} className="space-y-4">
            <input type="hidden" name="id" value={d.id} />
            <Field label="What changed?" name="notes" optional><Textarea name="notes" rows={3} /></Field>
            <Field label="Preview URL" name="previewUrl" optional><Input name="previewUrl" type="url" defaultValue={d.previewUrl ?? ""} /></Field>
            <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Create version</Tr></Submit></div>
          </Form>
        )}
      </Dialog>
    </div>
  );
}
