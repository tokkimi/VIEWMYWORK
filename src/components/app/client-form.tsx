"use client";

import { Form, Submit, Field, Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ClientFields, type ClientValues } from "./entity-fields";
import { createClientAction, updateClientAction, inviteClientToPortalAction, sendClientEmailAction, addClientContactAction } from "@/server/actions/clients";
import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Mail, UserPlus, Send, Pencil, Plus } from "lucide-react";

export function ClientForm({ v, onDone }: { v: ClientValues; onDone?: () => void }) {
  return (
    <Form action={v.id ? updateClientAction : createClientAction} redirectTo={v.id ? undefined : (d) => `/app/clients/${(d as { id: string }).id}`} onSuccess={onDone} className="space-y-6">
      <ClientFields v={v} />
      <div className="flex justify-end border-t border-line pt-5"><Submit>{v.id ? "Save changes" : "Create client"}</Submit></div>
    </Form>
  );
}

export function EditClientDialog({ v }: { v: ClientValues }) {
  return (
    <Dialog title="Edit client" size="lg" trigger={(open) => <Button onClick={open}><Pencil className="size-4" />Edit</Button>}>
      {(close) => <ClientForm v={v} onDone={close} />}
    </Dialog>
  );
}

export function InviteToPortalDialog({ clientId, email, projectId, label = "Invite to portal" }: { clientId: string; email: string; projectId?: string; label?: string }) {
  const [res, setRes] = useState<{ link: string; emailStatus: string } | null>(null);
  return (
    <Dialog title="Invite to client portal" description="Your client gets a private portal to follow progress, approve work and pay invoices." trigger={(open) => <Button onClick={() => { setRes(null); open(); }}><UserPlus className="size-4" />{label}</Button>}>
      {(close) =>
        res ? (
          <div className="space-y-4 text-sm">
            {res.emailStatus === "SENT" ? <p>Invitation sent. The link is valid for 14 days.</p> : <p className="rounded-lg bg-warning-soft p-3 text-warning">The invitation was created but <strong>no email was sent</strong> (email delivery is not configured). Share this link with your client directly:</p>}
            <div className="flex items-center gap-2 rounded-lg border border-line p-2"><code className="min-w-0 flex-1 truncate text-xs">{res.link}</code><CopyButton value={res.link} label="Copy" /></div>
            <div className="flex justify-end"><Button onClick={close}>Done</Button></div>
          </div>
        ) : (
          <Form action={inviteClientToPortalAction} onSuccess={(d) => setRes(d as { link: string; emailStatus: string })} className="space-y-4">
            <input type="hidden" name="clientId" value={clientId} />
            {projectId && <input type="hidden" name="projectId" value={projectId} />}
            <Field label="Email" name="email"><Input name="email" type="email" defaultValue={email} required /></Field>
            <Field label="Personal message" name="message" optional><Textarea name="message" rows={3} /></Field>
            <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Send invitation</Submit></div>
          </Form>
        )
      }
    </Dialog>
  );
}

export function SendEmailDialog({ clientId, to, userEmail }: { clientId: string; to: string; userEmail: string }) {
  return (
    <Dialog title="Send email" description={`To ${to}. Replies go to ${userEmail}.`} trigger={(open) => <Button onClick={open}><Mail className="size-4" />Send email</Button>}>
      {(close) => (
        <Form action={sendClientEmailAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Subject" name="subject"><Input name="subject" required /></Field>
          <Field label="Message" name="message"><Textarea name="message" rows={7} required /></Field>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="sendCopy" className="accent-[#4d7cfe]" />Send me a copy</label>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit><Send className="size-4" />Send</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function AddContactDialog({ clientId }: { clientId: string }) {
  return (
    <Dialog title="Add contact" trigger={(open) => <Button size="sm" variant="ghost" onClick={open}><Plus className="size-3.5" />Add contact</Button>}>
      {(close) => (
        <Form action={addClientContactAction} onSuccess={close} resetOnSuccess className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Name" name="name"><Input name="name" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" optional><Input name="email" type="email" /></Field>
            <Field label="Phone" name="phone" optional><Input name="phone" /></Field>
          </div>
          <Field label="Role" name="role" optional><Input name="role" placeholder="Marketing lead" /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Add</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}
