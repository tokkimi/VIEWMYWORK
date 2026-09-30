"use client";

import { Form, Field, Input, Select, Submit } from "@/components/ui/form";
import { updateProfileAction, changePasswordAction } from "@/server/actions/auth";
import { Tr, useI18n } from "@/lib/i18n/client";

export function ProfileForm({ name, timezone, locale }: { name: string; timezone: string; locale: string }) {
  const { t } = useI18n();
  return (
    <Form action={updateProfileAction} className="space-y-4">
      <Field label="Name" name="name"><Input name="name" defaultValue={name} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone" name="timezone"><Input name="timezone" defaultValue={timezone} /></Field>
        <Field label="Language" name="locale"><Select name="locale" defaultValue={locale}><option value="en">{t("English")}</option><option value="fr">{t("Français")}</option></Select></Field>
      </div>
      <div className="flex justify-end"><Submit><Tr>Save</Tr></Submit></div>
    </Form>
  );
}

export function PasswordForm() {
  return (
    <Form action={changePasswordAction} resetOnSuccess className="space-y-4">
      <Field label="Current password" name="current"><Input name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="New password" name="password" hint="At least 10 characters."><Input name="password" type="password" autoComplete="new-password" required /></Field>
      <div className="flex justify-end"><Submit><Tr>Change password</Tr></Submit></div>
    </Form>
  );
}
