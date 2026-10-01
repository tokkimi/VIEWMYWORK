"use client";

import { Send, Mail } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, Field, Textarea, Select, Submit, Checkbox } from "@/components/ui/form";
import { useActionButton } from "./invoice-actions";
import { sendProjectReportAction, toggleProjectReportAction, saveReportSettingsAction, sendTeamDigestNowAction } from "@/server/actions/reports";
import { WEEKDAYS, type ReportSettings } from "@/lib/reports";
import { Tr, useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export function SendReportDialog({ projectId, projectName, clientName }: { projectId: string; projectName: string; clientName: string }) {
  const { t } = useI18n();
  return (
    <Dialog title={t("Send the report for {project}", { project: projectName })} description={t("{client} receives it by email and in their portal.", { client: clientName })} trigger={(open) => <Button size="sm" variant="secondary" onClick={open}><Send className="size-3.5" /><Tr>Send now</Tr></Button>}>
      {(close) => (
        <Form action={sendProjectReportAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="A word from the team" name="note" optional hint="Shown at the top of the report.">
            <Textarea name="note" rows={4} placeholder={t("e.g. Great week: the homepage is ready for your review!")} />
          </Field>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Send className="size-3.5" /><Tr>Send the report</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function ProjectReportToggle({ projectId, enabled, disabled }: { projectId: string; enabled: boolean; disabled?: boolean }) {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return (
    <button
      type="button" role="switch" aria-checked={enabled} aria-label={t("Include in automatic reports")} disabled={pending || disabled}
      onClick={() => run(() => toggleProjectReportAction(projectId, !enabled))}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50", enabled ? "bg-accent" : "bg-white/[0.12]")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", enabled ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export function ReportSettingsForm({ settings, canEdit }: { settings: ReportSettings; canEdit: boolean }) {
  const { t } = useI18n();
  return (
    <Form action={saveReportSettingsAction} className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <Checkbox name="clientReports" label={t("Send a weekly report to clients automatically")} description={t("One email per project with what was done, what's in progress, next steps and what's waiting for the client. Weeks with nothing to report are skipped.")} defaultChecked={settings.clientReports} />
        <Checkbox name="teamDigest" label={t("Send me and the admins a weekly portfolio digest")} description={t("Projects at risk, overdue tasks, client waits and the deadlines of the coming week.")} defaultChecked={settings.teamDigest} />
        <Field label="Day of the week" name="reportWeekday" className="max-w-xs">
          <Select name="reportWeekday" defaultValue={String(settings.weekday)}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{t(d)}</option>)}</Select>
        </Field>
      </fieldset>
      {canEdit ? <div className="flex justify-end"><Submit><Tr>Save</Tr></Submit></div> : <p className="text-xs text-subtle"><Tr>Only workspace admins can change these settings.</Tr></p>}
    </Form>
  );
}

export function DigestNowButton() {
  const { t } = useI18n();
  const { pending, run } = useActionButton();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => sendTeamDigestNowAction())}><Mail className="size-3.5" />{pending ? t("Sending…") : t("Send the digest now")}</Button>;
}
