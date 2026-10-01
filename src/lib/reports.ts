/** Weekly reports — shared types and the (pure, unit-tested) scheduling rules. */
import type { DecisionKind } from "@/lib/decisions";

export type ReportData = {
  project: { id: string; name: string; status: string; progress: number; targetDate: string | null };
  previousProgress: number | null;
  period: { start: string; end: string };
  done: { title: string; kind: "task" | "milestone" | "deliverable" }[];
  doneTotal: number;
  inProgress: string[];
  next: { title: string; date: string | null }[];
  waiting: { kind: DecisionKind; title: string; days: number }[];
  update: { title: string | null; body: string; nextSteps: string | null } | null;
};

export type ReportSettings = { clientReports: boolean; weekday: number; teamDigest: boolean };
export const DEFAULT_REPORTS: ReportSettings = { clientReports: false, weekday: 1, teamDigest: true };
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const DAY = 86_400_000;

/** Nothing worth telling the client this week: automatic reports are skipped. */
export function isEmptyReport(d: Pick<ReportData, "done" | "inProgress" | "next" | "waiting" | "update">) {
  return !d.done.length && !d.inProgress.length && !d.next.length && !d.waiting.length && !d.update;
}

/** Is today the configured day, and has nothing been sent in the last ~6 days? (Safe if the job runs twice.) */
export function weeklyDue(weekday: number, last: Date | null, now = new Date()) {
  if (now.getUTCDay() !== weekday) return false;
  return !last || now.getTime() - last.getTime() >= 6 * DAY;
}

/** Progress change since the previous report, or null for a first report. */
export function progressDelta(d: Pick<ReportData, "project" | "previousProgress">) {
  return d.previousProgress === null ? null : d.project.progress - d.previousProgress;
}
