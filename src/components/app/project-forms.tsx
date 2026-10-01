"use client";

import { useState } from "react";
import { Form, Submit, Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ProjectFields, type ProjectValues } from "./entity-fields";
import { createProjectAction, updateProjectAction, publishProjectUpdateAction, startClientWaitAction, saveProjectAsTemplateAction, setProgressModeAction, createScopeChangeAction, decideScopeChangeAction } from "@/server/actions/projects";
import { useActionButton } from "./invoice-actions";
import { Megaphone, Hourglass, LayoutTemplate } from "lucide-react";
import { Tr, useI18n } from "@/lib/i18n/client";

type Opt = { id: string; name: string };

export function NewProjectForm({ clients, members, templates, v }: { clients: Opt[]; members: Opt[]; templates: { id: string; name: string; phases: number }[]; v: ProjectValues }) {
  return (
    <Form action={createProjectAction} redirectTo={(d) => (d as { redirect: string }).redirect} className="space-y-8">
      <ProjectFields clients={clients} members={members} templates={templates} v={v} />
      <div className="flex justify-end border-t border-line pt-5"><Submit size="lg"><Tr>Create project</Tr></Submit></div>
    </Form>
  );
}

export function ProjectSettingsForm({ clients, members, v }: { clients: Opt[]; members: Opt[]; v: ProjectValues }) {
  return (
    <Form action={updateProjectAction} className="space-y-6">
      <ProjectFields clients={clients} members={members} v={v} />
      <div className="flex justify-end"><Submit><Tr>Save changes</Tr></Submit></div>
    </Form>
  );
}

export function PublishUpdateDialog({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  return (
    <Dialog title="Publish a project update" description="Your client sees updates in their portal timeline." trigger={(open) => <Button onClick={open}><Megaphone className="size-4" /><Tr>Post update</Tr></Button>}>
      {(close) => (
        <Form action={publishProjectUpdateAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Title" name="title" optional><Input name="title" placeholder={t("Dashboard development complete")} /></Field>
          <Field label="What happened" name="body"><Textarea name="body" rows={4} required /></Field>
          <Field label="What's next" name="nextSteps" optional><Textarea name="nextSteps" rows={2} placeholder={t("Mobile responsiveness and client testing.")} /></Field>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="notify" defaultChecked className="accent-[#4d7cfe]" /><Tr>Also email the client</Tr></label>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Publish</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function RequestFromClientDialog({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  return (
    <Dialog title="Request something from the client" description="Tracks how long the project waits on the client, and shows in their “Waiting for you”." trigger={(open) => <Button onClick={open}><Hourglass className="size-4" /><Tr>Request from client</Tr></Button>}>
      {(close) => (
        <Form action={startClientWaitAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Type" name="reason">
            <Select name="reason" defaultValue="DOCUMENT">
              <option value="DOCUMENT">{t("Document / assets")}</option>
              <option value="INFORMATION">{t("Information")}</option>
              <option value="APPROVAL">{t("Approval")}</option>
              <option value="OTHER">{t("Other")}</option>
            </Select>
          </Field>
          <Field label="What do you need?" name="label"><Input name="label" required placeholder={t("Company logo in vector format")} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Send request</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function SaveTemplateDialog({ projectId, name }: { projectId: string; name: string }) {
  const { t } = useI18n();
  return (
    <Dialog title="Save as template" description="Copies the phase & task structure (not dates, assignees or files)." trigger={(open) => <Button variant="ghost" onClick={open}><LayoutTemplate className="size-4" /><Tr>Save as template</Tr></Button>}>
      {(close) => (
        <Form action={saveProjectAsTemplateAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Template name" name="name"><Input name="name" defaultValue={t("{name} template", { name })} required /></Field>
          <Field label="Category" name="category"><Input name="category" defaultValue={t("Custom")} /></Field>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Save template</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function ProgressModeControl({ projectId, mode, manual, auto }: { projectId: string; mode: "AUTO" | "MANUAL"; manual: number | null; auto: number }) {
  const { t } = useI18n();
  const [m, setM] = useState(mode);
  const [val, setVal] = useState(manual ?? auto);
  const { pending, run } = useActionButton();
  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label={t("Progress mode")}>
        {(["AUTO", "MANUAL"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => { setM(k); if (k === "AUTO") run(() => setProgressModeAction(projectId, "AUTO")); }} className={`flex-1 rounded-md px-3 py-1.5 ${m === k ? "bg-white/[0.08] text-fg" : "text-muted"}`}>
            {k === "AUTO" ? t("Automatic (weighted)") : t("Manual override")}
          </button>
        ))}
      </div>
      {m === "MANUAL" && (
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} value={val} onChange={(e) => setVal(Number(e.target.value))} aria-label={t("Manual progress")} className="flex-1 accent-[#4d7cfe]" />
          <span className="num w-10 text-right text-sm">{val}%</span>
          <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => setProgressModeAction(projectId, "MANUAL", val), "Progress updated.")}><Tr>Apply</Tr></Button>
        </div>
      )}
    </div>
  );
}

export function ScopeChangeDialog({ projectId }: { projectId: string }) {
  return (
    <Dialog title="Record a scope change" trigger={(open) => <Button size="sm" onClick={open}><Tr>Add scope change</Tr></Button>}>
      {(close) => (
        <Form action={createScopeChangeAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Description" name="description"><Textarea name="description" rows={3} required /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Requested by" name="requestedBy"><Input name="requestedBy" required /></Field>
            <Field label="Additional cost" name="additionalCost" optional><Input name="additionalCost" inputMode="decimal" /></Field>
            <Field label="Additional days" name="additionalDays" optional><Input name="additionalDays" type="number" min={0} defaultValue={0} /></Field>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="askClient" defaultChecked className="mt-0.5 accent-[#4d7cfe]" /><span><Tr>Ask the client to accept or decline it from their portal</Tr><span className="block text-xs text-muted"><Tr>They&apos;re notified by email; once accepted, the deadline, budget and a task are updated automatically.</Tr></span></span></label>
          <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Save</Tr></Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function DecideScopeChange({ id, canExtend }: { id: string; canExtend: boolean }) {
  return (
    <Form action={decideScopeChangeAction} className="flex flex-wrap items-center gap-3 text-xs">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-center gap-1.5 text-muted"><input type="checkbox" name="createTask" className="accent-[#4d7cfe]" /><Tr>Create task</Tr></label>
      {canExtend && <label className="flex items-center gap-1.5 text-muted"><input type="checkbox" name="extendDeadline" className="accent-[#4d7cfe]" /><Tr>Extend deadline</Tr></label>}
      <button name="decision" value="REJECTED" className="rounded-md border border-line px-2 py-1 text-muted hover:text-fg"><Tr>Reject</Tr></button>
      <button name="decision" value="APPROVED" className="rounded-md bg-accent px-2 py-1 text-white"><Tr>Approve</Tr></button>
    </Form>
  );
}
