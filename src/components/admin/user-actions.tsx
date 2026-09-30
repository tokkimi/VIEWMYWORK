"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Select, Input, Submit } from "@/components/ui/form";
import { useActionButton } from "@/components/app/invoice-actions";
import { setUserStatusAction, setPlatformRoleAction, changeWorkspacePlanAction } from "@/server/actions/admin";
import { toDateInput } from "@/lib/format";

export function UserActions({ id, status, role }: { id: string; status: string; role: string }) {
  const { pending, run } = useActionButton();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACTIVE" ? (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => confirm("Suspend this user? They'll be signed out everywhere.") && run(() => setUserStatusAction(id, "SUSPENDED"))}>Suspend</Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => run(() => setUserStatusAction(id, "ACTIVE"))}>Reactivate</Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(role === "SUPER_ADMIN" ? "Remove platform admin access?" : "Grant platform admin access?") && run(() => setPlatformRoleAction(id, role === "SUPER_ADMIN" ? "USER" : "SUPER_ADMIN"))}>
        {role === "SUPER_ADMIN" ? "Revoke admin" : "Make admin"}
      </Button>
    </div>
  );
}

export function ChangePlanDialog({ workspaceId, plans, current }: { workspaceId: string; plans: { id: string; name: string }[]; current: { planId: string; status: string; trialEndsAt: Date | null } }) {
  return (
    <Dialog title="Change plan / subscription" trigger={(open) => <Button size="sm" onClick={open}>Change plan</Button>}>
      {(close) => (
        <Form action={changeWorkspacePlanAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <Field label="Plan" name="planId"><Select name="planId" defaultValue={current.planId}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Status" name="status"><Select name="status" defaultValue={current.status}>{["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Trial ends" name="trialEndsAt" optional><Input name="trialEndsAt" type="date" defaultValue={toDateInput(current.trialEndsAt)} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Save</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}
