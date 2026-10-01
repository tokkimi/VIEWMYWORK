/**
 * Team workload engine (pure functions, no database access — unit tested).
 *
 * Model: every open task carries a remaining effort (estimate − time already spent, or a default
 * when nothing is estimated). That effort is spread evenly over the working days between the
 * task's start (or today) and its deadline. Overdue work lands on today. Capacity is the member's
 * weekly hours prorated to the working days of the week that aren't covered by an absence.
 */

export const DEFAULT_TASK_MINUTES = 120;
export const DAY_MS = 86_400_000;

export type WorkTask = {
  id: string;
  assigneeId: string | null;
  status: string;
  startDate: Date | null;
  deadline: Date | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  /** Parent tasks with subtasks are not counted (their subtasks carry the work). */
  hasSubtasks?: boolean;
};

export type Absence = { memberUserId: string; startDate: Date; endDate: Date };

const OPEN = new Set(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "WAITING_FOR_CLIENT", "IN_REVIEW"]);
export const isOpen = (status: string) => OPEN.has(status);

/** UTC midnight of the given instant. */
export const day = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const isWorkday = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date) {
  const x = day(d);
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(x.getTime() - dow * DAY_MS);
}

/** Working days (Mon–Fri) from `from` to `to`, both inclusive, as UTC midnights. */
export function workdays(from: Date, to: Date) {
  const out: Date[] = [];
  for (let t = day(from).getTime(); t <= day(to).getTime(); t += DAY_MS) {
    const d = new Date(t);
    if (isWorkday(d)) out.push(d);
  }
  return out;
}

/** Remaining effort of a task in minutes (0 for closed tasks and parents with subtasks). */
export function remainingMinutes(t: WorkTask) {
  if (!isOpen(t.status) || t.hasSubtasks) return 0;
  if (t.estimatedMinutes && t.estimatedMinutes > 0) {
    const left = t.estimatedMinutes - (t.actualMinutes ?? 0);
    // Over-run but still open: keep a quarter of the estimate so it still weighs on the plan.
    return Math.max(left, Math.round(t.estimatedMinutes * 0.25));
  }
  return DEFAULT_TASK_MINUTES;
}

/** Minutes of a task's remaining effort that fall on each working day (key = UTC midnight ms). */
export function spread(t: WorkTask, today: Date): Map<number, number> {
  const out = new Map<number, number>();
  const minutes = remainingMinutes(t);
  if (!minutes || !t.deadline) return out;
  const t0 = day(today);
  const end = day(t.deadline);
  if (end < t0) {
    // Overdue: everything is due now.
    out.set(t0.getTime(), minutes);
    return out;
  }
  const start = t.startDate && day(t.startDate) > t0 ? day(t.startDate) : t0;
  let days = workdays(start <= end ? start : end, end);
  if (!days.length) days = [isWorkday(end) ? end : workdays(t0, new Date(end.getTime() + 3 * DAY_MS))[0] ?? end];
  const per = minutes / days.length;
  for (const d of days) out.set(d.getTime(), (out.get(d.getTime()) ?? 0) + per);
  return out;
}

/** Working days of a week not covered by one of the member's absences. */
export function availableDays(week: Date, absences: Absence[]) {
  const days = workdays(week, new Date(week.getTime() + 4 * DAY_MS));
  return days.filter((d) => !absences.some((a) => day(a.startDate) <= d && d <= day(a.endDate)));
}

export type WeekLoad = { week: Date; load: number; capacity: number; utilization: number; absentDays: number };

/** Load vs capacity for `weeks` consecutive weeks starting with the week of `today`. */
export function memberWeeks(opts: { tasks: WorkTask[]; weeklyCapacityMinutes: number; absences: Absence[]; today: Date; weeks: number }): WeekLoad[] {
  const first = weekStart(opts.today);
  const perDay = new Map<number, number>();
  for (const t of opts.tasks) for (const [k, v] of spread(t, opts.today)) perDay.set(k, (perDay.get(k) ?? 0) + v);
  const out: WeekLoad[] = [];
  for (let w = 0; w < opts.weeks; w++) {
    const week = new Date(first.getTime() + w * 7 * DAY_MS);
    let load = 0;
    for (let i = 0; i < 7; i++) load += perDay.get(week.getTime() + i * DAY_MS) ?? 0;
    const avail = availableDays(week, opts.absences);
    const capacity = Math.round((opts.weeklyCapacityMinutes * avail.length) / 5);
    load = Math.round(load);
    out.push({ week, load, capacity, utilization: capacity > 0 ? Math.round((load / capacity) * 100) : load > 0 ? 999 : 0, absentDays: 5 - avail.length });
  }
  return out;
}

export type LoadLevel = "free" | "ok" | "busy" | "over";
export function loadLevel(utilization: number): LoadLevel {
  if (utilization > 100) return "over";
  if (utilization >= 85) return "busy";
  if (utilization >= 40) return "ok";
  return "free";
}

export type Candidate = { userId: string; weeklyCapacityMinutes: number; absences: Absence[]; tasks: WorkTask[]; projectIds: Set<string> | "all" };

/**
 * Suggests an assignee for each unassigned task: among members who can work on the task's project,
 * the one with the most free capacity in the week the task is due (greedy, so suggestions made for
 * earlier tasks count when placing the next ones). Tasks are placed by deadline, earliest first.
 */
export function suggestAssignees(unassigned: (WorkTask & { projectId: string })[], candidates: Candidate[], today: Date) {
  const extra = new Map<string, WorkTask[]>(candidates.map((c) => [c.userId, []]));
  const result = new Map<string, string>();
  const ordered = [...unassigned].sort((a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity));
  for (const t of ordered) {
    if (!isOpen(t.status) || t.hasSubtasks) continue;
    const due = t.deadline && day(t.deadline) > day(today) ? weekStart(t.deadline) : weekStart(today);
    const weeksAhead = Math.max(1, Math.round((due.getTime() - weekStart(today).getTime()) / (7 * DAY_MS)) + 1);
    let best: { userId: string; free: number } | null = null;
    for (const c of candidates) {
      if (c.projectIds !== "all" && !c.projectIds.has(t.projectId)) continue;
      const weeks = memberWeeks({ tasks: [...c.tasks, ...extra.get(c.userId)!], weeklyCapacityMinutes: c.weeklyCapacityMinutes, absences: c.absences, today, weeks: weeksAhead });
      const w = weeks[weeks.length - 1]!;
      const free = w.capacity - w.load;
      if (w.capacity <= 0) continue;
      if (!best || free > best.free) best = { userId: c.userId, free };
    }
    if (best) {
      result.set(t.id, best.userId);
      extra.get(best.userId)!.push({ ...t, assigneeId: best.userId });
    }
  }
  return result;
}

export const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
