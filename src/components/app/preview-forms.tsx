"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Select, Submit, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useActionButton } from "./invoice-actions";
import { addPreviewAction, refreshPreviewAction, deletePreviewAction, addLinkAction, deleteLinkAction } from "@/server/actions/previews";

export function AddPreviewDialog({ projectId }: { projectId: string }) {
  return (
    <Dialog title="Add preview" trigger={(open) => <Button size="sm" onClick={open}><Plus className="size-3.5" />Add preview</Button>}>
      {(close) => (
        <Form action={addPreviewAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Label" name="label"><Input name="label" required placeholder="Staging website" /></Field>
          <Field label="URL" name="url"><Input name="url" type="url" required placeholder="https://staging.example.com" /></Field>
          <Field label="Type" name="type">
            <Select name="type" defaultValue="WEBSITE">
              <option value="WEBSITE">Website</option>
              <option value="MOBILE_APP">Mobile app</option>
              <option value="PROTOTYPE">Prototype</option>
              <option value="EXTERNAL">External link</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Checkbox name="internal" label="Internal only" />
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit pendingLabel="Checking…">Add</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function PreviewItemActions({ id }: { id: string }) {
  const { pending, run } = useActionButton();
  return (
    <>
      <button aria-label="Re-check preview" disabled={pending} onClick={() => run(() => refreshPreviewAction(id))} className="rounded p-1 text-subtle hover:text-fg"><RefreshCw className="size-3.5" /></button>
      <button aria-label="Remove preview" disabled={pending} onClick={() => confirm("Remove this preview?") && run(() => deletePreviewAction(id))} className="rounded p-1 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>
    </>
  );
}

export function AddLinkDialog({ projectId }: { projectId: string }) {
  return (
    <Dialog title="Add link" trigger={(open) => <Button size="sm" onClick={open}><Plus className="size-3.5" />Add link</Button>}>
      {(close) => (
        <Form action={addLinkAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Label" name="label"><Input name="label" required placeholder="Figma file" /></Field>
          <Field label="URL" name="url"><Input name="url" type="url" required /></Field>
          <Checkbox name="internal" label="Internal only" />
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Add</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function DeleteLinkButton({ id }: { id: string }) {
  const { pending, run } = useActionButton();
  return <button aria-label="Remove link" disabled={pending} onClick={() => run(() => deleteLinkAction(id))} className="rounded p-1 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>;
}
