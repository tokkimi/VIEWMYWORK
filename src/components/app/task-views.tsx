"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TaskStatus, Priority } from "@prisma/client";
import { LayoutList, Columns3, Flag, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/primitives";
import { TaskStatusBadge } from "@/components/status";
import { TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import { useToast } from "@/components/ui/toast";
import { setTaskStatusAction } from "@/server/actions/spec";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Select, Submit } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { addTaskAction } from "@/server/actions/spec";
import { Tr, useI18n } from "@/lib/i18n/client";

export type TaskItem = { id: string; title: string; status: TaskStatus; priority: Priority; deadline: string | null; projectId: string; projectName: string; clientName: string; phaseTitle: string | null; assignee: { id: string; name: string } | null; internal: boolean };

export function ViewToggle({ view }: { view: "list" | "board" }) {
  const { t: tr } = useI18n();
  const path = usePathname();
  const sp = useSearchParams();
  const href = (v: string) => { const p = new URLSearchParams(sp.toString()); p.set("view", v); p.delete("task"); return `${path}?${p}`; };
  return (
    <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label={tr("View")}>
      <Link href={href("list")} aria-current={view === "list" ? "true" : undefined} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs", view === "list" ? "bg-white/[0.08] text-fg" : "text-muted")}><LayoutList className="size-3.5" /><Tr>List</Tr></Link>
      <Link href={href("board")} aria-current={view === "board" ? "true" : undefined} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs", view === "board" ? "bg-white/[0.08] text-fg" : "text-muted")}><Columns3 className="size-3.5" /><Tr>Board</Tr></Link>
    </div>
  );
}

function useTaskHref() {
  const path = usePathname();
  const sp = useSearchParams();
  return (id: string) => { const p = new URLSearchParams(sp.toString()); p.set("task", id); return `${path}?${p}`; };
}

export function TaskList({ tasks, showProject = true }: { tasks: TaskItem[]; showProject?: boolean }) {
  const { t: tr, fmt } = useI18n();
  const href = useTaskHref();
  const now = Date.now();
  return (
    <div className="panel overflow-hidden rounded-2xl">
      <ul className="divide-y divide-line">
        {tasks.map((t) => {
          const late = t.deadline && t.status !== "COMPLETED" && new Date(t.deadline).getTime() < now;
          return (
            <li key={t.id}>
              <Link href={href(t.id)} scroll={false} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-white/[0.02] md:grid-cols-[minmax(0,1fr)_200px_140px_80px_32px]">
                <div className="min-w-0">
                  <div className={cn("flex items-center gap-2 truncate text-sm", t.status === "COMPLETED" && "text-muted line-through decoration-white/20")}>
                    {t.title}
                    {t.internal && <EyeOff className="size-3 shrink-0 text-subtle" aria-label={tr("Internal")} />}
                    {(t.priority === "HIGH" || t.priority === "URGENT") && <Flag className={cn("size-3 shrink-0", t.priority === "URGENT" ? "text-danger" : "text-warning")} aria-label={`${t.priority} priority`} />}
                  </div>
                  {showProject && <div className="truncate text-xs text-muted">{t.projectName}{t.phaseTitle ? ` · ${t.phaseTitle}` : ""}</div>}
                </div>
                <div className="hidden truncate text-xs text-subtle md:block">{t.clientName}</div>
                <div className="justify-self-end md:justify-self-start"><TaskStatusBadge s={t.status} /></div>
                <div className={cn("num hidden text-xs md:block", late ? "text-danger" : "text-subtle")}>{t.deadline ? fmt.short(t.deadline) : "—"}</div>
                <div className="hidden md:block">{t.assignee ? <Avatar name={t.assignee.name} size={24} /> : null}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Kanban board by status; drag a card to change its status (server-validated). */
export function TaskBoard({ tasks: initial }: { tasks: TaskItem[] }) {
  const { t: tr, fmt } = useI18n();
  const [tasks, setTasks] = useState(initial);
  const [drag, setDrag] = useState<string | null>(null);
  const [, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const href = useTaskHref();
  useEffect(() => setTasks(initial), [initial]);
  const move = (id: string, status: TaskStatus) => {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    start(async () => {
      const r = await setTaskStatusAction(id, status);
      if (!r.ok) { toast.error(r.error); setTasks(prev); }
      router.refresh();
    });
  };
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1100px] grid-cols-6 gap-3">
        {TASK_STATUSES.map((s) => {
          const col = tasks.filter((t) => t.status === s);
          return (
            <section key={s} aria-label={tr(TASK_STATUS[s].label)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(drag, s); setDrag(null); }} className="flex min-h-64 flex-col rounded-2xl border border-line bg-white/[0.015]">
              <header className="flex items-center justify-between px-3 py-2.5 text-xs"><TaskStatusBadge s={s} /><span className="num text-subtle">{col.length}</span></header>
              <ul className="flex-1 space-y-2 p-2">
                {col.map((t) => (
                  <li key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} className={cn("panel cursor-grab rounded-xl p-3 active:cursor-grabbing", drag === t.id && "opacity-40")}>
                    <Link href={href(t.id)} scroll={false} className="block text-[13px] leading-snug hover:underline">{t.title}</Link>
                    <div className="mt-1 truncate text-[11px] text-subtle">{t.projectName}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="num text-[11px] text-subtle">{t.deadline ? fmt.short(t.deadline) : ""}</span>
                      {t.assignee && <Avatar name={t.assignee.name} size={20} />}
                    </div>
                    <label className="sr-only" htmlFor={`st-${t.id}`}><Tr>Status</Tr></label>
                    <select id={`st-${t.id}`} value={t.status} onChange={(e) => move(t.id, e.target.value as TaskStatus)} className="sr-only focus:not-sr-only focus:mt-2 focus:w-full focus:rounded focus:bg-surface focus:text-xs">
                      {TASK_STATUSES.map((x) => <option key={x} value={x}>{tr(TASK_STATUS[x].label)}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function NewTaskDialog({ projects, members, defaultProjectId, openInitially }: { projects: { id: string; name: string }[]; members: { id: string; name: string }[]; defaultProjectId?: string; openInitially?: boolean }) {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(Boolean(openInitially));
  const router = useRouter();
  const path = usePathname();
  return (
    <Dialog title="New task" open={open} onOpenChange={(o) => { setOpen(o); if (!o && openInitially) router.replace(path, { scroll: false }); }} trigger={(o) => <Button variant="primary" onClick={o}><Tr>New task</Tr></Button>}>
      {(close) =>
        projects.length === 0 ? <p className="text-sm text-muted"><Tr>Create a project first.</Tr></p> : (
          <Form action={addTaskAction} onSuccess={close} className="space-y-4">
            <Field label="Title" name="title"><Input name="title" required autoFocus /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project" name="projectId"><Select name="projectId" defaultValue={defaultProjectId ?? projects[0].id}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Assignee" name="assigneeId" optional><Select name="assigneeId" defaultValue=""><option value="">{tr("Unassigned")}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
              <Field label="Deadline" name="deadline" optional><Input name="deadline" type="date" /></Field>
              <Field label="Priority" name="priority"><Select name="priority" defaultValue="MEDIUM"><option value="LOW">{tr("Low")}</option><option value="MEDIUM">{tr("Medium")}</option><option value="HIGH">{tr("High")}</option><option value="URGENT">{tr("Urgent")}</option></Select></Field>
              <Field label="Visibility" name="visibility" className="sm:col-span-2"><Select name="visibility" defaultValue="CLIENT_VISIBLE"><option value="CLIENT_VISIBLE">{tr("Visible to client")}</option><option value="INTERNAL">{tr("Internal")}</option></Select></Field>
            </div>
            <div className="flex justify-end gap-2"><Button onClick={close}><Tr>Cancel</Tr></Button><Submit><Tr>Create task</Tr></Submit></div>
          </Form>
        )
      }
    </Dialog>
  );
}
