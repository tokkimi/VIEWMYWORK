"use client";

import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, Field, Input, Submit, Checkbox } from "@/components/ui/form";
import { useActionButton } from "./invoice-actions";
import { remindClientAction, saveReminderSettingsAction } from "@/server/actions/decisions";
import { Tr, useI18n } from "@/lib/i18n/client";
import type { ReminderSettings } from "@/lib/decisions";

/** Sends a reminder now — for one item (keys) or everything pending for the client. */
export function RemindButton({ clientId, keys, disabled, label, variant = "secondary" }: { clientId: string; keys?: string[]; disabled?: boolean; label?: string; variant?: "primary" | "secondary" | "ghost" }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <Button size="sm" variant={variant} disabled={pending || disabled} title={disabled ? t("Already reminded in the last 24 hours") : undefined} onClick={() => run(() => remindClientAction(clientId, keys))}>
      <BellRing className="size-3.5" /> {pending ? t("Sending…") : label ?? t("Remind")}
    </Button>
  );
}

export function ReminderSettingsForm({ settings, canEdit }: { settings: ReminderSettings; canEdit: boolean }) {
  const { t } = useI18n();
  return (
    <Form action={saveReminderSettingsAction} className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <Checkbox name="decisionReminders" label={t("Remind clients automatically")} description={t("One grouped email per client, with a link to their portal. Invoices keep their own payment reminders.")} defaultChecked={settings.enabled} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First reminder after (days)" name="reminderFirstDays"><Input name="reminderFirstDays" type="number" min={1} max={30} defaultValue={settings.firstDays} required /></Field>
          <Field label="Then every (days)" name="reminderEveryDays"><Input name="reminderEveryDays" type="number" min={1} max={30} defaultValue={settings.everyDays} required /></Field>
          <Field label="Maximum reminders per item" name="reminderMax"><Input name="reminderMax" type="number" min={1} max={10} defaultValue={settings.max} required /></Field>
        </div>
      </fieldset>
      {canEdit ? <div className="flex justify-end"><Submit><Tr>Save</Tr></Submit></div> : <p className="text-xs text-subtle"><Tr>Only workspace admins can change these settings.</Tr></p>}
    </Form>
  );
}
