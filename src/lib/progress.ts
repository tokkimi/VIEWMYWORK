import type { TaskStatus } from "@prisma/client";
import type { Tx } from "@/lib/db";

type T = { weight: number; status: TaskStatus; subtasks?: T[] };
type P = { weight: number; status: TaskStatus; tasks: T[] };

export function taskProgress(t: T): number {
  if (t.status === "COMPLETED") return 100;
  if (t.subtasks && t.subtasks.length) return weightedAverage(t.subtasks.map((s) => ({ weight: s.weight, value: taskProgress(s) })));
  return 0;
}

export function weightedAverage(items: { weight: number; value: number }[]) {
  const total = items.reduce((a, i) => a + Math.max(0, i.weight), 0);
  if (total <= 0) return items.length ? items.reduce((a, i) => a + i.value, 0) / items.length : 0;
  return items.reduce((a, i) => a + Math.max(0, i.weight) * i.value, 0) / total;
}

export function phaseProgress(p: P): number {
  if (!p.tasks.length) return p.status === "COMPLETED" ? 100 : 0;
  return weightedAverage(p.tasks.map((t) => ({ weight: t.weight, value: taskProgress(t) })));
}

/** Project progress = Σ(phase progress × phase weight) / Σ(weights). Tasks without phase form an implicit phase. */
export function projectProgress(phases: P[], looseTasks: T[] = []) {
  const all = [...phases];
  if (looseTasks.length) all.push({ weight: phases.length ? 1 : 1, status: "NOT_STARTED", tasks: looseTasks });
  if (!all.length) return 0;
  return Math.round(weightedAverage(all.map((p) => ({ weight: p.weight, value: phaseProgress(p) }))));
}

export function derivePhaseStatus(progress: number, tasks: { status: TaskStatus }[], current: TaskStatus): TaskStatus {
  if (!tasks.length) return current;
  if (progress >= 100) return "COMPLETED";
  if (tasks.some((t) => t.status === "BLOCKED")) return "BLOCKED";
  if (tasks.some((t) => t.status === "WAITING_FOR_CLIENT")) return "WAITING_FOR_CLIENT";
  if (tasks.some((t) => t.status !== "NOT_STARTED")) return "IN_PROGRESS";
  return "NOT_STARTED";
}

/** Recomputes and stores phase + project progress. Called after any spec/task change. */
export async function recalcProject(tx: Tx, projectId: string) {
  const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { progressMode: true, manualProgress: true } });
  const phases = await tx.phase.findMany({ where: { projectId }, orderBy: { position: "asc" } });
  const tasks = await tx.task.findMany({ where: { projectId }, select: { id: true, parentId: true, phaseId: true, weight: true, status: true } });
  const byParent = new Map<string, typeof tasks>();
  for (const t of tasks) if (t.parentId) byParent.set(t.parentId, [...(byParent.get(t.parentId) ?? []), t]);
  const tree = (t: (typeof tasks)[number]): T => ({ weight: t.weight, status: t.status, subtasks: (byParent.get(t.id) ?? []).map(tree) });
  const top = tasks.filter((t) => !t.parentId);

  const phaseInputs: P[] = [];
  for (const ph of phases) {
    const pt = top.filter((t) => t.phaseId === ph.id).map(tree);
    const input = { weight: ph.weight, status: ph.status, tasks: pt };
    const prog = Math.round(phaseProgress(input));
    const status = derivePhaseStatus(prog, pt, ph.status);
    if (prog !== ph.progress || status !== ph.status) await tx.phase.update({ where: { id: ph.id }, data: { progress: prog, status } });
    phaseInputs.push({ ...input, status });
  }
  const loose = top.filter((t) => !t.phaseId).map(tree);
  const auto = projectProgress(phaseInputs, loose);
  const progress = project.progressMode === "MANUAL" && project.manualProgress !== null ? project.manualProgress : auto;
  await tx.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}
