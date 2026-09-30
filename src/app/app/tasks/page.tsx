import { Suspense } from "react";
import { CheckSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, projectScope, can } from "@/lib/auth/context";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { LinkTabs } from "@/components/ui/tabs";
import { inputClass } from "@/components/ui/form";
import { listTasks, type TaskFilters } from "@/server/queries/tasks";
import { TaskList, TaskBoard, ViewToggle, NewTaskDialog, type TaskItem } from "@/components/app/task-views";
import { TaskPanelLoader } from "@/components/app/task-panel-loader";
import { TASK_STATUS, TASK_STATUSES } from "@/lib/labels";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Tasks");

export default async function Tasks({ searchParams }: { searchParams: Promise<TaskFilters & { view?: string; task?: string; new?: string }> }) {
  const { t } = await getI18n();
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const tab = sp.tab ?? "mine";
  const view = sp.view === "board" ? "board" : "list";
  const [tasks, projects, members, clients] = await Promise.all([
    listTasks(ctx, { ...sp, tab: view === "board" && tab === "completed" ? "all" : tab }),
    db.project.findMany({ where: { ...projectScope(ctx), archivedAt: null }, select: { id: true, name: true, clientId: true }, orderBy: { name: "asc" } }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } }),
    can(ctx, "clients", "view") ? db.client.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, select: { id: true, company: true, firstName: true, lastName: true } }) : Promise.resolve([]),
  ]);
  const items: TaskItem[] = tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, deadline: t.deadline?.toISOString() ?? null, projectId: t.project.id, projectName: t.project.name, clientName: t.project.client.company || `${t.project.client.firstName} ${t.project.client.lastName}`, phaseTitle: t.phase?.title ?? null, assignee: t.assignee, internal: t.visibility === "INTERNAL" }));
  const tabHref = (t: string) => `/app/tasks?tab=${t}${view === "board" ? "&view=board" : ""}`;
  const keep = (k: string) => (sp[k as keyof typeof sp] ? <input type="hidden" name={k} value={String(sp[k as keyof typeof sp])} /> : null);

  return (
    <>
      <PageHeader title="Tasks" actions={<><Suspense><ViewToggle view={view} /></Suspense>{can(ctx, "tasks", "edit") && <NewTaskDialog projects={projects} members={members.map((m) => ({ id: m.user.id, name: m.user.name }))} openInitially={sp.new === "1"} />}</>} />
      <Suspense>
        <LinkTabs tabs={[{ href: tabHref("mine"), label: "My tasks" }, { href: tabHref("all"), label: "All tasks" }, { href: tabHref("overdue"), label: "Overdue" }, { href: tabHref("upcoming"), label: "Upcoming" }, { href: tabHref("waiting"), label: "Waiting for client" }, { href: tabHref("completed"), label: "Completed" }]} />
      </Suspense>
      <form className="mb-5 flex flex-wrap gap-2" aria-label={t("Filters")}>
        {keep("tab")}{keep("view")}
        <input name="q" defaultValue={sp.q} placeholder={t("Search tasks…")} aria-label={t("Search tasks")} className={`${inputClass} w-48`} />
        <select name="projectId" defaultValue={sp.projectId ?? ""} aria-label={t("Project")} className={`${inputClass} w-auto`}><option value="">{t("All projects")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {clients.length > 0 && <select name="clientId" defaultValue={sp.clientId ?? ""} aria-label={t("Client")} className={`${inputClass} w-auto`}><option value="">{t("All clients")}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company || `${c.firstName} ${c.lastName}`}</option>)}</select>}
        <select name="assigneeId" defaultValue={sp.assigneeId ?? ""} aria-label={t("Assignee")} className={`${inputClass} w-auto`}><option value="">{t("Anyone")}</option><option value="none">{t("Unassigned")}</option>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label={t("Status")} className={`${inputClass} w-auto`}><option value="">{t("Any status")}</option>{TASK_STATUSES.map((s) => <option key={s} value={s}>{t(TASK_STATUS[s].label)}</option>)}</select>
        <select name="priority" defaultValue={sp.priority ?? ""} aria-label={t("Priority")} className={`${inputClass} w-auto`}><option value="">{t("Any priority")}</option><option value="URGENT">{t("Urgent")}</option><option value="HIGH">{t("High")}</option><option value="MEDIUM">{t("Medium")}</option><option value="LOW">{t("Low")}</option></select>
        <button className="h-9 rounded-[10px] border border-line px-3 text-sm text-muted hover:text-fg"><Tr>Apply</Tr></button>
      </form>
      {items.length === 0 ? (
        <EmptyState icon={<CheckSquare />} title={tab === "mine" ? t("Nothing assigned to you") : t("No tasks match")} description={tab === "mine" ? "Tasks assigned to you across all projects appear here." : undefined} />
      ) : view === "board" ? (
        <Suspense><TaskBoard tasks={items} /></Suspense>
      ) : (
        <Suspense><TaskList tasks={items} /></Suspense>
      )}
      {sp.task && <TaskPanelLoader taskId={sp.task} closeHref={`/app/tasks?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "task" && typeof v === "string") as [string, string][])}`} />}
    </>
  );
}
