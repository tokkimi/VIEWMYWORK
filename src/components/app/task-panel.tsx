"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TaskStatus, Priority, Visibility } from "@prisma/client";
import { X, Trash2, Plus, Link2, Lock } from "lucide-react";
import { Form, Field, Input, Select, Textarea, Submit } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import { centsToInput } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { FileDTO } from "@/lib/file-dto";
import type { ActionResult } from "@/lib/errors";
import { updateTaskAction, addChecklistItemAction, toggleChecklistItemAction, deleteChecklistItemAction, addDependencyAction, removeDependencyAction, addTaskAction, setTaskStatusAction } from "@/server/actions/spec";
import { FileGrid } from "./files";
import { Uploader } from "./uploader";
import { MessageThread, type MessageDTO } from "./messages";
import { Tr, useI18n } from "@/lib/i18n/client";

type TaskDetail = {
  id: string; projectId: string; title: string; description: string | null; status: TaskStatus; priority: Priority; weight: number; visibility: Visibility;
  assigneeId: string | null; phaseId: string | null; milestoneId: string | null; startDate: string | null; deadline: string | null;
  estimatedMinutes: number | null; actualMinutes: number | null; costCents: number | null; internalNotes: string | null; requiresApproval: boolean;
  currency: string; projectName: string; phaseTitle: string | null; parent: { id: string; title: string } | null;
  checklist: { id: string; label: string; done: boolean }[]; dependencies: { id: string; title: string; status: TaskStatus }[]; subtasks: { id: string; title: string; status: TaskStatus }[];
};

/** Slide-over task editor. Closing returns to the originating list URL. */
export function TaskPanel({ task, members, phases, milestones, siblings, files, messages, canEdit, canUpload, canMessage, storageConfigured, closeHref }: { task: TaskDetail; members: { id: string; name: string }[]; phases: { id: string; title: string }[]; milestones: { id: string; title: string }[]; siblings: { id: string; title: string }[]; files: FileDTO[]; messages: MessageDTO[]; canEdit: boolean; canUpload: boolean; canMessage: boolean; storageConfigured: boolean; closeHref: string }) {
  const { t: tr } = useI18n();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const [depPick, setDepPick] = useState("");
  const close = () => router.push(closeHref, { scroll: false });
  useEffect(() => {
    panel.current?.focus();
    const h = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = (fn: () => Promise<ActionResult<unknown>>) => start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error); router.refresh(); });

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={tr("Task: {name}", { name: task.title })}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
      <div ref={panel} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl outline-none">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0 text-xs text-muted">
            <Link href={`/app/projects/${task.projectId}/specification`} className="hover:text-fg">{task.projectName}</Link>
            {task.phaseTitle && <> / {task.phaseTitle}</>}
            {task.parent && <> / <Link href={`?task=${task.parent.id}`} className="hover:text-fg">{task.parent.title}</Link></>}
          </div>
          <button onClick={close} aria-label={tr("Close")} className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-fg"><X className="size-4" /></button>
        </div>
        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-5">
          <Form action={updateTaskAction} successMessage="Task saved." className="space-y-4" key={task.id}>
            <fieldset disabled={!canEdit} className="space-y-4">
              <input type="hidden" name="id" value={task.id} />
              <Field label="Title" name="title"><Input name="title" defaultValue={task.title} required className="text-[15px] font-medium" /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Status" name="status"><Select name="status" defaultValue={task.status}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{tr(TASK_STATUS[s].label)}</option>)}</Select></Field>
                <Field label="Priority" name="priority"><Select name="priority" defaultValue={task.priority}><option value="LOW">{tr("Low")}</option><option value="MEDIUM">{tr("Medium")}</option><option value="HIGH">{tr("High")}</option><option value="URGENT">{tr("Urgent")}</option></Select></Field>
                <Field label="Assignee" name="assigneeId"><Select name="assigneeId" defaultValue={task.assigneeId ?? ""}><option value="">{tr("Unassigned")}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
                <Field label="Start" name="startDate"><Input name="startDate" type="date" defaultValue={toDateInput(task.startDate)} /></Field>
                <Field label="Deadline" name="deadline"><Input name="deadline" type="date" defaultValue={toDateInput(task.deadline)} /></Field>
                <Field label="Weight" name="weight"><Input name="weight" type="number" min={0} max={1000} defaultValue={task.weight} /></Field>
                {!task.parent && <Field label="Phase" name="phaseId"><Select name="phaseId" defaultValue={task.phaseId ?? ""}><option value="">—</option>{phases.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>}
                <Field label="Milestone" name="milestoneId"><Select name="milestoneId" defaultValue={task.milestoneId ?? ""}><option value="">—</option>{milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</Select></Field>
                <Field label="Visibility" name="visibility"><Select name="visibility" defaultValue={task.visibility}><option value="CLIENT_VISIBLE">{tr("Visible to client")}</option><option value="INTERNAL">{tr("Internal")}</option></Select></Field>
                <Field label="Estimated (h)" name="estimatedHours"><Input name="estimatedHours" inputMode="decimal" defaultValue={task.estimatedMinutes !== null ? String(task.estimatedMinutes / 60) : ""} /></Field>
                <Field label="Actual (h)" name="actualHours"><Input name="actualHours" inputMode="decimal" defaultValue={task.actualMinutes !== null ? String(task.actualMinutes / 60) : ""} /></Field>
                <Field label={`${tr("Cost")} (${task.currency})`} name="cost"><Input name="cost" inputMode="decimal" defaultValue={centsToInput(task.costCents)} /></Field>
              </div>
              <Field label="Description" name="description" optional><Textarea name="description" rows={4} defaultValue={task.description ?? ""} /></Field>
              <Field label="Internal notes" name="internalNotes" optional hint="Never shown to the client."><Textarea name="internalNotes" rows={2} defaultValue={task.internalNotes ?? ""} className="border-dashed" /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="hidden" name="requiresApproval" value="off" /><input type="checkbox" name="requiresApproval" value="on" defaultChecked={task.requiresApproval} className="accent-[#4d7cfe]" /><Tr>Requires client approval</Tr></label>
            </fieldset>
            {canEdit && <div className="flex justify-end"><Submit size="sm"><Tr>Save task</Tr></Submit></div>}
          </Form>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold"><Tr>Checklist</Tr></h3>
            <ul className="space-y-1">
              {task.checklist.map((c) => (
                <li key={c.id} className="group flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.done} disabled={!canEdit || pending} onChange={() => run(() => toggleChecklistItemAction(c.id))} aria-label={c.label} className="size-4 accent-[#4d7cfe]" />
                  <span className={cn("flex-1", c.done && "text-muted line-through")}>{c.label}</span>
                  {canEdit && <button aria-label={tr("Remove item")} onClick={() => run(() => deleteChecklistItemAction(c.id))} className="hidden text-subtle hover:text-danger group-hover:block"><Trash2 className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <Form action={addChecklistItemAction} resetOnSuccess className="mt-2 flex items-center gap-2">
                <input type="hidden" name="taskId" value={task.id} />
                <Plus className="size-3.5 text-subtle" />
                <input name="label" aria-label={tr("New checklist item")} placeholder={tr("Add item…")} className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" />
              </Form>
            )}
          </section>

          {!task.parent && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold"><Tr>Subtasks</Tr></h3>
              <ul className="space-y-1">
                {task.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={s.status === "COMPLETED"} disabled={!canEdit || pending} onChange={() => run(() => setTaskStatusAction(s.id, s.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED"))} aria-label={s.title} className="size-4 accent-[#4d7cfe]" />
                    <Link href={`?task=${s.id}`} scroll={false} className={cn("hover:underline", s.status === "COMPLETED" && "text-muted line-through")}>{s.title}</Link>
                  </li>
                ))}
              </ul>
              {canEdit && (
                <Form action={addTaskAction} resetOnSuccess className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="projectId" value={task.projectId} />
                  <input type="hidden" name="parentId" value={task.id} />
                  <input type="hidden" name="visibility" value={task.visibility} />
                  <Plus className="size-3.5 text-subtle" />
                  <input name="title" aria-label={tr("New subtask")} placeholder={tr("Add subtask…")} className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" />
                </Form>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[13px] font-semibold"><Tr>Depends on</Tr></h3>
            {task.dependencies.length === 0 && <p className="text-sm text-subtle"><Tr>No dependencies.</Tr></p>}
            <ul className="space-y-1">
              {task.dependencies.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <Link2 className="size-3.5 text-subtle" />
                  <Link href={`?task=${d.id}`} scroll={false} className="flex-1 hover:underline">{d.title}</Link>
                  <span className="text-xs text-subtle">{tr(TASK_STATUS[d.status].label)}</span>
                  {canEdit && <button aria-label={tr("Remove dependency")} onClick={() => run(() => removeDependencyAction(task.id, d.id))} className="text-subtle hover:text-danger"><X className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-2 flex gap-2">
                <select value={depPick} onChange={(e) => setDepPick(e.target.value)} aria-label={tr("Add dependency")} className="h-8 flex-1 rounded-lg border border-line bg-surface px-2 text-sm">
                  <option value="">{tr("Select a task this depends on…")}</option>
                  {siblings.filter((s) => !task.dependencies.some((d) => d.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <button disabled={!depPick || pending} onClick={() => { run(() => addDependencyAction(task.id, depPick)); setDepPick(""); }} className="h-8 rounded-lg border border-line px-3 text-xs disabled:opacity-40"><Tr>Add</Tr></button>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold"><Tr>Files & links</Tr></h3>
            {canUpload && <div className="mb-3"><Uploader target={{ taskId: task.id }} configured={storageConfigured} compact defaultVisibility={task.visibility === "INTERNAL" ? "INTERNAL" : "INTERNAL"} /></div>}
            {files.length ? <FileGrid files={files} canManage={canUpload} /> : <p className="text-sm text-subtle"><Tr>No files attached.</Tr></p>}
          </section>

          {canMessage && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Tr>Comments</Tr> {task.visibility === "INTERNAL" && <span className="flex items-center gap-1 text-[11px] font-normal text-warning"><Lock className="size-3" /><Tr>internal task</Tr></span>}</h3>
              <MessageThread messages={messages} projectId={task.projectId} entityType="TASK" entityId={task.id} canPost allowClientVisible={task.visibility === "CLIENT_VISIBLE"} poll={false} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
