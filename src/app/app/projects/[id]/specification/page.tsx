import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { SpecBuilder, type SpecPhase } from "@/components/app/spec-builder";
import { TaskPanelLoader } from "@/components/app/task-panel-loader";
import { Section } from "@/components/ui/primitives";
import { ProgressModeControl, ScopeChangeDialog, DecideScopeChange, SaveTemplateDialog } from "@/components/app/project-forms";
import { Badge } from "@/components/ui/primitives";
import { projectProgress } from "@/lib/progress";
import { Tr } from "@/lib/i18n/client";
import { storedText } from "@/lib/i18n/core";
import { getI18n } from "@/lib/i18n/server";

export default async function Specification({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ task?: string }> }) {
  const { t, fmt } = await getI18n();
  const { id } = await params;
  const { task } = await searchParams;
  const { ctx, project, perms } = await loadProject(id);
  const [phases, loose, members, scopeChanges, history] = await Promise.all([
    db.phase.findMany({
      where: { projectId: id },
      orderBy: { position: "asc" },
      include: {
        milestones: { orderBy: { position: "asc" } },
        tasks: { where: { parentId: null }, orderBy: { position: "asc" }, include: { assignee: { select: { id: true, name: true } }, subtasks: { orderBy: { position: "asc" }, select: { id: true, title: true, status: true, weight: true } }, _count: { select: { checklist: true } } } },
      },
    }),
    db.task.findMany({ where: { projectId: id, phaseId: null, parentId: null }, orderBy: { position: "asc" }, include: { assignee: { select: { id: true, name: true } }, subtasks: { orderBy: { position: "asc" }, select: { id: true, title: true, status: true, weight: true } }, _count: { select: { checklist: true } } } }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } }),
    db.scopeChange.findMany({ where: { projectId: id }, orderBy: { requestedAt: "desc" } }),
    db.specHistory.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const mapTask = (t: (typeof loose)[number]) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, weight: t.weight, visibility: t.visibility, deadline: t.deadline?.toISOString() ?? null, assignee: t.assignee, requiresApproval: t.requiresApproval, subtasks: t.subtasks, checklistCount: t._count.checklist, milestoneId: t.milestoneId });
  const spec: SpecPhase[] = phases.map((p) => ({ id: p.id, title: p.title, description: p.description, weight: p.weight, progress: p.progress, status: p.status, visibility: p.visibility, startDate: p.startDate?.toISOString() ?? null, deadline: p.deadline?.toISOString() ?? null, milestones: p.milestones.map((m) => ({ id: m.id, title: m.title, dueDate: m.dueDate?.toISOString() ?? null, completedAt: m.completedAt?.toISOString() ?? null, visibility: m.visibility })), tasks: p.tasks.map(mapTask) }));
  const canEdit = hasLevel(perms, "projects", "edit");
  const canManage = hasLevel(perms, "projects", "manage");
  const auto = projectProgress(phases.map((p) => ({ weight: p.weight, status: p.status, tasks: p.tasks.map((t) => ({ weight: t.weight, status: t.status, subtasks: t.subtasks })) })), loose.map((t) => ({ weight: t.weight, status: t.status, subtasks: t.subtasks })));

  return (
    <div className="grid gap-10 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <SpecBuilder projectId={id} phases={spec} loose={loose.map(mapTask)} members={members.map((m) => ({ id: m.user.id, name: m.user.name }))} canEdit={canEdit} canEditTasks={hasLevel(perms, "tasks", "edit")} canManage={canManage} />
      <aside className="space-y-8">
        {canManage && (
          <Section title="Progress" description="Σ phase progress × phase weight. Switch to manual only when needed.">
            <div className="panel rounded-2xl p-4"><ProgressModeControl projectId={id} mode={project.progressMode} manual={project.manualProgress} auto={auto} /></div>
          </Section>
        )}
        <Section title="Scope changes" action={canManage ? <ScopeChangeDialog projectId={id} /> : undefined}>
          {scopeChanges.length === 0 ? <p className="text-sm text-subtle"><Tr>No scope changes recorded.</Tr></p> : (
            <ul className="space-y-2">
              {scopeChanges.map((s) => (
                <li key={s.id} className="panel rounded-xl p-3 text-sm">
                  <div className="flex items-start justify-between gap-2"><span className="whitespace-pre-line">{s.description}</span><Badge tone={s.status === "APPROVED" ? "success" : s.status === "REJECTED" ? "neutral" : "warning"}>{s.status.toLowerCase()}</Badge></div>
                  <div className="mt-1 text-xs text-subtle">{s.requestedBy} · {fmt.date(s.requestedAt)}{s.additionalCostCents ? ` · +${fmt.money(s.additionalCostCents, project.currency)}` : ""}{s.additionalDays ? ` · +${s.additionalDays}d` : ""}</div>
                  {s.status === "PROPOSED" && canManage && <div className="mt-2"><DecideScopeChange id={s.id} canExtend={Boolean(project.targetDate && s.additionalDays)} /></div>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Specification history">
          {history.length === 0 ? <p className="text-sm text-subtle"><Tr>No changes yet.</Tr></p> : (
            <ol className="space-y-2.5 border-l border-line pl-4 text-[13px]">
              {history.map((h) => <li key={h.id}><div>{storedText(fmt.locale, h.change, h.metadata)}</div><div className="text-[11px] text-subtle">{h.actorName} · {fmt.dateTime(h.createdAt)}</div></li>)}
            </ol>
          )}
        </Section>
        {canManage && <SaveTemplateDialog projectId={id} name={project.name} />}
      </aside>
      {task && <TaskPanelLoader taskId={task} closeHref={`/app/projects/${id}/specification`} />}
    </div>
  );
}
