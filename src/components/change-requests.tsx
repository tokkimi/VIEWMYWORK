"use client";

import { useState } from "react";
import { Form, Field, Select, Input, Textarea, Submit, Checkbox } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n/client";
import { CHANGE_SUBJECTS, CHANGE_REQUEST_STATUS } from "@/lib/labels";
import { createChangeRequestAction, updateChangeRequestAction, saveProjectPagesAction } from "@/server/actions/change-requests";

/** Client form: pick a subject and the concerned page, then describe the change. */
export function ChangeRequestForm({ projectId, pages }: { projectId: string; pages: string[] }) {
  const { t } = useI18n();
  const [page, setPage] = useState("");
  return (
    <Form action={createChangeRequestAction} resetOnSuccess onSuccess={() => setPage("")} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Topic" name="subject">
          <Select name="subject" defaultValue="DESIGN" required>
            {Object.entries(CHANGE_SUBJECTS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </Select>
        </Field>
        <Field label="Concerned page" name="page">
          <Select name="page" value={page} onChange={(e) => setPage(e.target.value)}>
            <option value="">{t("Whole project / general")}</option>
            {pages.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="__other">{t("Other page…")}</option>
          </Select>
        </Field>
      </div>
      {page === "__other" && <Field label="Which page?" name="pageOther"><Input name="pageOther" required maxLength={160} placeholder={t("e.g. Pricing page, checkout, footer…")} /></Field>}
      <Field label="Your feedback" name="message" hint="Be as specific as possible: what you see, what you expect, and any text to change.">
        <Textarea name="message" rows={6} required maxLength={5000} placeholder={t("Describe the change you'd like…")} />
      </Field>
      <div className="flex justify-end"><Submit pendingLabel="Sending…">Send request</Submit></div>
    </Form>
  );
}

/** Professional form: status, answer to the client, optional conversion into a task. */
export function ChangeRequestReply({ id, status, response, hasTask }: { id: string; status: keyof typeof CHANGE_REQUEST_STATUS; response: string | null; hasTask: boolean }) {
  const { t } = useI18n();
  return (
    <Form action={updateChangeRequestAction} className="mt-4 space-y-3 border-t border-line pt-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="Status" name="status">
          <Select name="status" defaultValue={status}>
            {Object.entries(CHANGE_REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
          </Select>
        </Field>
        <Field label="Reply to the client" name="response" optional>
          <Textarea name="response" rows={2} defaultValue={response ?? ""} placeholder={t("e.g. Done — the logo is now larger on every page.")} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hasTask ? <Checkbox name="createTask" label="Create a task from this request" /> : <span />}
        <Submit size="sm">Update request</Submit>
      </div>
    </Form>
  );
}

/** Professional form: the pages/screens clients can reference. */
export function ProjectPagesForm({ projectId, pages }: { projectId: string; pages: string[] }) {
  return (
    <Form action={saveProjectPagesAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <Field label="Pages the client can select" name="pages" hint="One per line — e.g. Home, About, Contact, Checkout.">
        <Textarea name="pages" rows={5} defaultValue={pages.join("\n")} />
      </Field>
      <div className="flex justify-end"><Submit size="sm">Save pages</Submit></div>
    </Form>
  );
}
