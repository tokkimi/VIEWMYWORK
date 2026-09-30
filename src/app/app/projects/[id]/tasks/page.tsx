import { Suspense } from "react";
import { CheckSquare } from "lucide-react";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { EmptyState } from "@/components/ui/primitives";
import { LinkTabs } from "@/components/ui/tabs";
import { listTasks } from "@/server/queries/tasks";
import { TaskList, TaskBoard, ViewToggle, NewTaskDialog, type TaskItem } from "@/components/app/task-views";
import { TaskPanelLoader } from "@/components/app/task-panel-loader";
import { getI18n } from "@/lib/i18n/server";

export default async function ProjectTasks({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; tab?: string; task?: string; new?: string }> }) {
  const { t } = await getI18n();
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, perms } = await loadProject(id);
  const view = sp.view === "board" ? "board" : "list";
  const tab = sp.tab ?? "all";
  const [tasks, members] = await Promise.all([
    listTasks(ctx, { tab: view === "board" ? "all" : tab, projectId: id }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  const items: TaskItem[] = tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, deadline: t.deadline?.toISOString() ?? null, projectId: id, projectName: t.project.name, clientName: "", phaseTitle: t.phase?.title ?? null, assignee: t.assignee, internal: t.visibility === "INTERNAL" }));
  const base = `/app/projects/${id}/tasks`;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Suspense><ViewToggle view={view} /></Suspense>
        {hasLevel(perms, "tasks", "edit") && <NewTaskDialog projects={[{ id, name: t("This project") }]} members={members.map((m) => ({ id: m.user.id, name: m.user.name }))} defaultProjectId={id} openInitially={sp.new === "1"} />}
      </div>
      {view === "list" && (
        <Suspense>
          <LinkTabs className="mb-5" tabs={[{ href: `${base}?tab=all`, label: "All" }, { href: `${base}?tab=mine`, label: "Mine" }, { href: `${base}?tab=overdue`, label: "Overdue" }, { href: `${base}?tab=waiting`, label: "Waiting for client" }, { href: `${base}?tab=completed`, label: "Completed" }]} />
        </Suspense>
      )}
      {items.length === 0 ? <EmptyState icon={<CheckSquare />} title="No tasks" description="Add tasks here or structure them in the Specification tab." /> : view === "board" ? <Suspense><TaskBoard tasks={items} /></Suspense> : <Suspense><TaskList tasks={items} showProject={false} /></Suspense>}
      {sp.task && <TaskPanelLoader taskId={sp.task} closeHref={`${base}${sp.view ? `?view=${sp.view}` : sp.tab ? `?tab=${sp.tab}` : ""}`} />}
    </>
  );
}
