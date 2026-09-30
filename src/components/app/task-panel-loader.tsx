import { db } from "@/lib/db";
import { requireWorkspace, projectScope, isUuid, getProjectAccess } from "@/lib/auth/context";
import { hasLevel } from "@/lib/auth/permissions";
import { integrations } from "@/lib/env";
import { toFileDTO } from "@/lib/file-dto";
import { TaskPanel } from "./task-panel";

/** Server-side loader for the task drawer (URL-driven: ?task=<id>). Access is re-checked here. */
export async function TaskPanelLoader({ taskId, closeHref }: { taskId: string; closeHref: string }) {
  if (!isUuid(taskId)) return null;
  const ctx = await requireWorkspace();
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId: ctx.workspace.id, project: projectScope(ctx) },
    include: {
      checklist: { orderBy: { position: "asc" } },
      dependencies: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
      subtasks: { orderBy: { position: "asc" }, select: { id: true, title: true, status: true } },
      project: { select: { id: true, name: true, currency: true } },
      phase: { select: { id: true, title: true } },
      parent: { select: { id: true, title: true } },
    },
  });
  if (!task) return null;
  const { perms } = await getProjectAccess(ctx, task.projectId);
  const [members, phases, milestones, siblings, files, messages] = await Promise.all([
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true } } } }),
    db.phase.findMany({ where: { projectId: task.projectId }, orderBy: { position: "asc" }, select: { id: true, title: true } }),
    db.milestone.findMany({ where: { projectId: task.projectId }, orderBy: { position: "asc" }, select: { id: true, title: true } }),
    db.task.findMany({ where: { projectId: task.projectId, id: { not: task.id } }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 300 }),
    db.file.findMany({ where: { taskId: task.id, deletedAt: null, status: "READY" }, orderBy: { createdAt: "desc" } }),
    db.message.findMany({ where: { workspaceId: ctx.workspace.id, entityType: "TASK", entityId: task.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <TaskPanel
      closeHref={closeHref}
      canEdit={hasLevel(perms, "tasks", "edit")}
      canUpload={hasLevel(perms, "files", "upload")}
      canMessage={hasLevel(perms, "messages", "view")}
      storageConfigured={integrations.storage()}
      task={{
        id: task.id, projectId: task.projectId, title: task.title, description: task.description, status: task.status, priority: task.priority, weight: task.weight, visibility: task.visibility,
        assigneeId: task.assigneeId, phaseId: task.phaseId, milestoneId: task.milestoneId, startDate: task.startDate?.toISOString() ?? null, deadline: task.deadline?.toISOString() ?? null,
        estimatedMinutes: task.estimatedMinutes, actualMinutes: task.actualMinutes, costCents: task.costCents, internalNotes: task.internalNotes, requiresApproval: task.requiresApproval,
        currency: task.project.currency, projectName: task.project.name, phaseTitle: task.phase?.title ?? null, parent: task.parent,
        checklist: task.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done })),
        dependencies: task.dependencies.map((d) => d.dependsOn),
        subtasks: task.subtasks,
      }}
      members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
      phases={phases}
      milestones={milestones}
      siblings={siblings}
      files={files.map(toFileDTO)}
      messages={messages}
    />
  );
}
