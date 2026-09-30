"use client";

import { Tr, useI18n } from "@/lib/i18n/client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { TaskStatus, Priority, Visibility } from "@prisma/client";
import { ChevronDown, ChevronRight, GripVertical, Plus, MoreHorizontal, Copy, Trash2, Eye, EyeOff, Flag, ArrowUp, ArrowDown, Calendar, CheckSquare, ShieldCheck, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Select, Textarea, Submit, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Avatar, ProgressBar } from "@/components/ui/primitives";
import { TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import type { ActionResult } from "@/lib/errors";
import {
  addPhaseAction, updatePhaseAction, deletePhaseAction, duplicatePhaseAction, reorderPhasesAction,
  addTaskAction, setTaskStatusAction, updateTaskAction, deleteTaskAction, duplicateTaskAction, reorderTasksAction,
  addMilestoneAction, toggleMilestoneAction, deleteMilestoneAction,
} from "@/server/actions/spec";

export type SpecTask = { id: string; title: string; status: TaskStatus; priority: Priority; weight: number; visibility: Visibility; deadline: string | null; assignee: { id: string; name: string } | null; requiresApproval: boolean; subtasks: { id: string; title: string; status: TaskStatus; weight: number }[]; checklistCount: number; milestoneId: string | null };
export type SpecPhase = { id: string; title: string; description: string | null; weight: number; progress: number; status: TaskStatus; visibility: Visibility; startDate: string | null; deadline: string | null; milestones: { id: string; title: string; dueDate: string | null; completedAt: string | null; visibility: Visibility }[]; tasks: SpecTask[] };

type Props = { projectId: string; phases: SpecPhase[]; loose: SpecTask[]; members: { id: string; name: string }[]; canEdit: boolean; canEditTasks: boolean; canManage: boolean };

const statusDot: Record<TaskStatus, string> = {
  NOT_STARTED: "border-white/25",
  IN_PROGRESS: "border-accent bg-accent/30",
  BLOCKED: "border-danger bg-danger/30",
  WAITING_FOR_CLIENT: "border-warning bg-warning/30",
  IN_REVIEW: "border-accent bg-accent/60",
  COMPLETED: "border-success bg-success",
};

function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult<unknown>>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else if (ok || r.message) toast.success(r.message ?? ok!);
      router.refresh();
    });
  return { pending, run };
}

export function SpecBuilder({ projectId, phases: initial, loose: initialLoose, members, canEdit, canEditTasks, canManage }: Props) {
  const { t: tr, fmt } = useI18n();
  const [phases, setPhases] = useState(initial);
  const [loose, setLoose] = useState(initialLoose);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragPhase, setDragPhase] = useState<string | null>(null);
  const [dragTask, setDragTask] = useState<{ id: string; from: string | null } | null>(null);
  const { run } = useRun();
  useEffect(() => setPhases(initial), [initial]);
  useEffect(() => setLoose(initialLoose), [initialLoose]);
  const totalWeight = phases.reduce((a, p) => a + p.weight, 0) || 1;

  const movePhase = (id: string, dir: -1 | 1 | { before: string }) => {
    const ids = phases.map((p) => p.id);
    const from = ids.indexOf(id);
    ids.splice(from, 1);
    const to = typeof dir === "number" ? Math.max(0, Math.min(ids.length, from + dir)) : ids.indexOf(dir.before);
    ids.splice(to < 0 ? ids.length : to, 0, id);
    setPhases(ids.map((x) => phases.find((p) => p.id === x)!));
    run(() => reorderPhasesAction(projectId, ids));
  };

  const dropTask = (targetPhase: string | null, beforeTaskId: string | null) => {
    if (!dragTask) return;
    const list = (pid: string | null) => (pid ? phases.find((p) => p.id === pid)!.tasks : loose);
    const moving = list(dragTask.from).find((t) => t.id === dragTask.id);
    if (!moving) return;
    const target = list(targetPhase).filter((t) => t.id !== moving.id);
    const idx = beforeTaskId ? target.findIndex((t) => t.id === beforeTaskId) : target.length;
    target.splice(idx < 0 ? target.length : idx, 0, moving);
    const strip = (ts: SpecTask[]) => ts.filter((t) => t.id !== moving.id);
    setPhases((ps) => ps.map((p) => (p.id === targetPhase ? { ...p, tasks: target } : { ...p, tasks: strip(p.tasks) })));
    setLoose((ls) => (targetPhase === null ? target : strip(ls)));
    setDragTask(null);
    run(() => reorderTasksAction(projectId, targetPhase, target.map((t) => t.id)));
  };

  if (!phases.length && !loose.length)
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center">
        <h3 className="text-[15px] font-medium"><Tr>Build the specification</Tr></h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted"><Tr>Break the project into weighted phases (e.g. Discovery 10%, Design 25%, Development 45%…), then add milestones, tasks and deliverables.</Tr></p>
        {canEdit && <div className="mx-auto mt-6 max-w-md"><AddPhaseForm projectId={projectId} /></div>}
      </div>
    );

  return (
    <div className="space-y-3">
      {phases.map((p, idx) => {
        const open = !collapsed.has(p.id);
        const share = Math.round((p.weight / totalWeight) * 100);
        return (
          <section
            key={p.id}
            aria-label={tr("Phase {name}", { name: p.title })}
            onDragOver={(e) => (dragPhase || dragTask) && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragPhase && dragPhase !== p.id) movePhase(dragPhase, { before: p.id });
              else if (dragTask) dropTask(p.id, null);
              setDragPhase(null);
            }}
            className={cn("panel overflow-hidden rounded-2xl transition-opacity", dragPhase === p.id && "opacity-40")}
          >
            <header className="flex items-center gap-2 px-3 py-3 sm:px-4">
              {canEdit && (
                <span draggable onDragStart={() => setDragPhase(p.id)} onDragEnd={() => setDragPhase(null)} className="cursor-grab text-subtle hover:text-muted" aria-hidden title="Drag to reorder">
                  <GripVertical className="size-4" />
                </span>
              )}
              <button onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} aria-expanded={open} aria-label={open ? tr("Collapse phase") : tr("Expand phase")} className="rounded p-0.5 text-muted hover:text-fg">
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              <span className="num w-5 text-xs text-subtle">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[15px] font-medium">{p.title}</h3>
                  {p.visibility === "INTERNAL" && <EyeOff className="size-3.5 text-subtle" aria-label={tr("Internal")} />}
                  {p.deadline && <span className="hidden text-xs text-subtle sm:inline">· {fmt.short(p.deadline)}</span>}
                </div>
              </div>
              <div className="hidden w-40 items-center gap-2 sm:flex">
                <ProgressBar value={p.progress} size="sm" label={`${p.title} progress`} />
                <span className="num w-8 text-right text-xs text-muted">{p.progress}%</span>
              </div>
              <span className="num hidden w-14 text-right text-xs text-subtle md:block" title="Weight in project progress">{share}<Tr>% wt</Tr></span>
              {canEdit && (
                <PhaseMenu phase={p} onMove={(d) => movePhase(p.id, d)} first={idx === 0} last={idx === phases.length - 1} canManage={canManage} />
              )}
            </header>
            {open && (
              <div className="border-t border-line">
                {p.milestones.length > 0 && (
                  <ul className="flex flex-wrap gap-2 border-b border-line px-4 py-2.5">
                    {p.milestones.map((m) => <MilestoneChip key={m.id} m={m} canEdit={canEdit} />)}
                  </ul>
                )}
                <TaskList tasks={p.tasks} phaseId={p.id} projectId={projectId} members={members} canEdit={canEditTasks} onDragStart={(id) => setDragTask({ id, from: p.id })} onDrop={(before) => dropTask(p.id, before)} dragging={Boolean(dragTask)} />
                {canEditTasks && <QuickAddTask projectId={projectId} phaseId={p.id} />}
              </div>
            )}
          </section>
        );
      })}

      {(loose.length > 0 || dragTask) && (
        <section className="panel rounded-2xl" onDragOver={(e) => dragTask && e.preventDefault()} onDrop={(e) => { e.preventDefault(); dropTask(null, null); }}>
          <header className="px-4 py-3 text-sm font-medium text-muted"><Tr>Unassigned to a phase</Tr></header>
          <div className="border-t border-line">
            <TaskList tasks={loose} phaseId={null} projectId={projectId} members={members} canEdit={canEditTasks} onDragStart={(id) => setDragTask({ id, from: null })} onDrop={(before) => dropTask(null, before)} dragging={Boolean(dragTask)} />
          </div>
        </section>
      )}

      {canEdit && <AddPhaseForm projectId={projectId} />}
    </div>
  );
}

function TaskList({ tasks, phaseId: _phaseId, projectId, members, canEdit, onDragStart, onDrop, dragging }: { tasks: SpecTask[]; phaseId: string | null; projectId: string; members: { id: string; name: string }[]; canEdit: boolean; onDragStart: (id: string) => void; onDrop: (before: string | null) => void; dragging: boolean }) {
  const { t: tr, fmt } = useI18n();
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const { pending, run } = useRun();
  const path = usePathname();
  if (!tasks.length) return <p className="px-4 py-4 text-sm text-subtle">{dragging ? tr("Drop here") : tr("No tasks yet.")}</p>;
  return (
    <ul role="list">
      {tasks.map((t) => {
        const subsOpen = openSubs.has(t.id);
        const doneSubs = t.subtasks.filter((s) => s.status === "COMPLETED").length;
        const late = t.deadline && t.status !== "COMPLETED" && new Date(t.deadline) < new Date();
        return (
          <li key={t.id} onDragOver={(e) => dragging && e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(t.id); }} className="border-b border-line last:border-b-0">
            <div className="group flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] sm:px-4">
              {canEdit ? (
                <span draggable onDragStart={(e) => { e.stopPropagation(); onDragStart(t.id); }} className="cursor-grab text-subtle opacity-0 group-hover:opacity-100" aria-hidden><GripVertical className="size-3.5" /></span>
              ) : <span className="w-3.5" />}
              <StatusToggle status={t.status} disabled={!canEdit || pending} onChange={(s) => run(() => setTaskStatusAction(t.id, s))} />
              <Link href={`${path}?task=${t.id}`} scroll={false} className={cn("min-w-0 flex-1 truncate text-sm hover:underline", t.status === "COMPLETED" && "text-muted line-through decoration-white/20")}>{t.title}</Link>
              {t.subtasks.length > 0 && (
                <button onClick={() => setOpenSubs((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} className="num flex items-center gap-1 rounded px-1.5 text-[11px] text-subtle hover:text-fg" aria-expanded={subsOpen} aria-label={tr("Subtasks")}>
                  <CheckSquare className="size-3" />{doneSubs}/{t.subtasks.length}
                </button>
              )}
              {t.requiresApproval && <ShieldCheck className="size-3.5 text-subtle" aria-label={tr("Requires client approval")} />}
              {t.visibility === "INTERNAL" ? <EyeOff className="size-3.5 text-subtle" aria-label={tr("Internal")} /> : null}
              {(t.priority === "HIGH" || t.priority === "URGENT") && <Flag className={cn("size-3.5", t.priority === "URGENT" ? "text-danger" : "text-warning")} aria-label={`${t.priority} priority`} />}
              {t.deadline && <span className={cn("num hidden text-[11px] sm:inline", late ? "text-danger" : "text-subtle")}><Calendar className="mr-0.5 inline size-3" />{fmt.short(t.deadline)}</span>}
              {t.assignee ? <Avatar name={t.assignee.name} size={22} /> : <span className="w-[22px]" />}
              {canEdit && <TaskMenu task={t} members={members} />}
            </div>
            {subsOpen && (
              <ul className="pb-2 pl-14 pr-4">
                {t.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-1 text-[13px]">
                    <StatusToggle status={s.status} size="sm" disabled={!canEdit || pending} onChange={(st) => run(() => setTaskStatusAction(s.id, st))} />
                    <span className={cn(s.status === "COMPLETED" && "text-muted line-through decoration-white/20")}>{s.title}</span>
                  </li>
                ))}
                {canEdit && <li><QuickAddTask projectId={projectId} parentId={t.id} compact /></li>}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StatusToggle({ status, onChange, disabled, size = "md" }: { status: TaskStatus; onChange: (s: TaskStatus) => void; disabled?: boolean; size?: "sm" | "md" }) {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => onChange(status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED")}
        onContextMenu={(e) => { e.preventDefault(); if (!disabled) setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !disabled) { e.preventDefault(); setOpen(true); } }}
        title={`${tr(TASK_STATUS[status].label)} — ${tr("click to toggle complete, right-click or ↓ for more")}`}
        aria-label={`${tr("Status")}: ${tr(TASK_STATUS[status].label)}`}
        className={cn("flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors", size === "sm" ? "size-3.5" : "size-[18px]", statusDot[status])}
      >
        {status === "COMPLETED" && <svg viewBox="0 0 12 12" className="size-2.5 text-bg"><path d="M2.5 6.5 5 9l4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul role="menu" className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
            {TASK_STATUSES.map((s) => (
              <li key={s}><button role="menuitem" autoFocus={s === status} onClick={() => { setOpen(false); onChange(s); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-white/[0.05]"><span className={cn("size-3 rounded-full border-[1.5px]", statusDot[s])} />{tr(TASK_STATUS[s].label)}</button></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TaskMenu({ task, members }: { task: SpecTask; members: { id: string; name: string }[] }) {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-white/[0.05]";
  const fd = (o: Record<string, string>) => { const f = new FormData(); f.set("id", task.id); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  return (
    <div className="relative">
      <button aria-label={tr("Task actions")} aria-haspopup="menu" onClick={() => setOpen(!open)} className="rounded p-1 text-subtle opacity-60 hover:text-fg group-hover:opacity-100"><MoreHorizontal className="size-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
            <button role="menuitem" disabled={pending} className={item} onClick={() => { setOpen(false); run(() => updateTaskAction(fd({ visibility: task.visibility === "INTERNAL" ? "CLIENT_VISIBLE" : "INTERNAL" }))); }}>
              {task.visibility === "INTERNAL" ? <><Eye className="size-3.5" /><Tr>Make visible to client</Tr></> : <><EyeOff className="size-3.5" /><Tr>Make internal</Tr></>}
            </button>
            <div className="px-2.5 pb-1 pt-2 text-[11px] text-subtle"><Tr>Assign to</Tr></div>
            <select aria-label={tr("Assignee")} defaultValue={task.assignee?.id ?? ""} onChange={(e) => { setOpen(false); run(() => updateTaskAction(fd({ assigneeId: e.target.value }))); }} className="mx-1 mb-1 w-[calc(100%-0.5rem)] rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px]">
              <option value="">{tr("Unassigned")}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button role="menuitem" disabled={pending} className={item} onClick={() => { setOpen(false); run(() => duplicateTaskAction(task.id)); }}><Copy className="size-3.5" /><Tr>Duplicate</Tr></button>
            <button role="menuitem" disabled={pending} className={cn(item, "text-danger")} onClick={() => { setOpen(false); if (confirm(tr("Delete “{name}”?", { name: task.title }))) run(() => deleteTaskAction(task.id)); }}><Trash2 className="size-3.5" /><Tr>Delete</Tr></button>
          </div>
        </>
      )}
    </div>
  );
}

function PhaseMenu({ phase, onMove, first, last, canManage }: { phase: SpecPhase; onMove: (d: -1 | 1) => void; first: boolean; last: boolean; canManage: boolean }) {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [milestone, setMilestone] = useState(false);
  const { pending, run } = useRun();
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-white/[0.05] disabled:opacity-40";
  return (
    <div className="relative">
      <button aria-label={tr("Phase actions")} aria-haspopup="menu" onClick={() => setOpen(!open)} className="rounded p-1 text-subtle hover:text-fg"><MoreHorizontal className="size-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
            <button role="menuitem" className={item} onClick={() => { setOpen(false); setEdit(true); }}><Pencil className="size-3.5" /><Tr>Edit phase</Tr></button>
            <button role="menuitem" className={item} onClick={() => { setOpen(false); setMilestone(true); }}><Flag className="size-3.5" /><Tr>Add milestone</Tr></button>
            <button role="menuitem" className={item} disabled={first} onClick={() => { setOpen(false); onMove(-1); }}><ArrowUp className="size-3.5" /><Tr>Move up</Tr></button>
            <button role="menuitem" className={item} disabled={last} onClick={() => { setOpen(false); onMove(1); }}><ArrowDown className="size-3.5" /><Tr>Move down</Tr></button>
            <button role="menuitem" className={item} disabled={pending} onClick={() => { setOpen(false); run(() => duplicatePhaseAction(phase.id)); }}><Copy className="size-3.5" /><Tr>Duplicate</Tr></button>
            {canManage && <button role="menuitem" className={cn(item, "text-danger")} disabled={pending} onClick={() => { setOpen(false); if (confirm(tr("Delete phase “{name}” and all its tasks?", { name: phase.title }))) run(() => deletePhaseAction(phase.id)); }}><Trash2 className="size-3.5" /><Tr>Delete</Tr></button>}
          </div>
        </>
      )}
      <Dialog title="Edit phase" open={edit} onOpenChange={setEdit}>
        {(close) => (
          <Form action={updatePhaseAction} onSuccess={close} className="space-y-4">
            <input type="hidden" name="id" value={phase.id} />
            <Field label="Title" name="title"><Input name="title" defaultValue={phase.title} required /></Field>
            <Field label="Description" name="description" optional><Textarea name="description" rows={3} defaultValue={phase.description ?? ""} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Weight" name="weight" hint="Relative share of project progress."><Input name="weight" type="number" min={0} max={1000} defaultValue={phase.weight} /></Field>
              <Field label="Start" name="startDate" optional><Input name="startDate" type="date" defaultValue={toDateInput(phase.startDate)} /></Field>
              <Field label="Deadline" name="deadline" optional><Input name="deadline" type="date" defaultValue={toDateInput(phase.deadline)} /></Field>
            </div>
            <Field label="Visibility" name="visibility">
              <Select name="visibility" defaultValue={phase.visibility}>
                <option value="CLIENT_VISIBLE">{tr("Visible to client")}</option>
                <option value="INTERNAL">{tr("Internal only")}</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Save</Tr></Submit></div>
          </Form>
        )}
      </Dialog>
      <Dialog title="Add milestone" open={milestone} onOpenChange={setMilestone}>
        {(close) => (
          <Form action={addMilestoneAction} onSuccess={close} className="space-y-4">
            <input type="hidden" name="phaseId" value={phase.id} />
            <Field label="Title" name="title"><Input name="title" required placeholder={tr("Design approved")} /></Field>
            <Field label="Due date" name="dueDate" optional><Input name="dueDate" type="date" /></Field>
            <Checkbox name="visibility" value="CLIENT_VISIBLE" label="Visible to client" defaultChecked />
            <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Add</Tr></Submit></div>
          </Form>
        )}
      </Dialog>
    </div>
  );
}

function MilestoneChip({ m, canEdit }: { m: SpecPhase["milestones"][number]; canEdit: boolean }) {
  const { t: tr, fmt } = useI18n();
  const { pending, run } = useRun();
  return (
    <li className={cn("group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", m.completedAt ? "border-success/30 text-success" : "border-line text-muted")}>
      <button disabled={!canEdit || pending} onClick={() => run(() => toggleMilestoneAction(m.id))} aria-label={m.completedAt ? tr("Mark milestone not reached") : tr("Mark milestone reached")} className="flex items-center gap-1.5">
        <Flag className="size-3" />{m.title}{m.dueDate && <span className="text-subtle">· {fmt.short(m.dueDate)}</span>}
      </button>
      {canEdit && <button aria-label={tr("Delete milestone")} onClick={() => confirm(tr("Delete milestone?")) && run(() => deleteMilestoneAction(m.id))} className="hidden text-subtle hover:text-danger group-hover:inline"><Trash2 className="size-3" /></button>}
    </li>
  );
}

function QuickAddTask({ projectId, phaseId, parentId, compact }: { projectId: string; phaseId?: string; parentId?: string; compact?: boolean }) {
  const { t: tr } = useI18n();
  return (
    <Form action={addTaskAction} resetOnSuccess className={cn("flex items-center gap-2", compact ? "py-1" : "px-4 py-2")}>
      <input type="hidden" name="projectId" value={projectId} />
      {phaseId && <input type="hidden" name="phaseId" value={phaseId} />}
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <Plus className="size-3.5 shrink-0 text-subtle" />
      <input name="title" aria-label={parentId ? tr("New subtask") : tr("New task")} placeholder={parentId ? tr("Add subtask…") : tr("Add task…")} className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" maxLength={200} />
    </Form>
  );
}

function AddPhaseForm({ projectId }: { projectId: string }) {
  const { t: tr } = useI18n();
  return (
    <Form action={addPhaseAction} resetOnSuccess className="flex flex-col gap-2 rounded-2xl border border-dashed border-line p-3 sm:flex-row sm:items-center">
      <input type="hidden" name="projectId" value={projectId} />
      <input name="title" aria-label={tr("New phase title")} placeholder={tr("New phase — e.g. Discovery")} required className="h-9 min-w-0 flex-1 rounded-[10px] bg-transparent px-2 text-sm outline-none placeholder:text-subtle" />
      <label className="flex items-center gap-2 text-xs text-muted"><Tr>Weight</Tr><input name="weight" type="number" min={0} max={1000} defaultValue={10} aria-label={tr("Phase weight")} className="h-8 w-16 rounded-lg border border-line bg-transparent px-2 text-sm" /></label>
      <Submit size="sm" variant="secondary"><Plus className="size-3.5" /><Tr>Add phase</Tr></Submit>
    </Form>
  );
}
