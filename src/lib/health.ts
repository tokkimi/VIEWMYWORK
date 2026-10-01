/**
 * Project health engine (pure, unit tested). Turns raw project figures into a 0–100 score,
 * a status and concrete, actionable alerts. Every alert carries a translatable message.
 */
import type { Msg } from "@/lib/i18n/core";

export type HealthInput = {
  status: string;
  progress: number; // 0–100
  startDate: Date | null;
  targetDate: Date | null;
  createdAt: Date;
  overdueTasks: number;
  openTasks: number;
  blockedTasks: number;
  budgetCents: number | null;
  costToDateCents: number; // expenses + time spent × hourly cost
  plannedCostCents: number; // planned task costs + estimated time × hourly cost
  invoicedCents: number;
  paidCents: number;
  overdueInvoiceCents: number;
  clientWaits: { days: number }[]; // open "waiting for client" items
  pendingApprovals: number; // deliverables waiting for the client
  openChangeRequests: number;
  nextDeadline: Date | null;
};

export type Alert = { level: "danger" | "warning" | "info"; kind: "schedule" | "budget" | "client" | "tasks" | "cash"; msg: Msg };
export type Health = { score: number; status: "on_track" | "at_risk" | "off_track" | "done"; expectedProgress: number | null; forecastCostCents: number | null; marginCents: number | null; marginPct: number | null; budgetUsedPct: number | null; alerts: Alert[] };

const DAY = 86_400_000;

export function projectHealth(p: HealthInput, now = new Date()): Health {
  const alerts: Alert[] = [];
  if (p.status === "COMPLETED" || p.status === "CANCELLED") {
    const revenue = Math.max(p.budgetCents ?? 0, p.invoicedCents);
    const margin = revenue ? revenue - p.costToDateCents : null;
    return { score: 100, status: "done", expectedProgress: null, forecastCostCents: p.costToDateCents, marginCents: margin, marginPct: margin !== null && revenue ? Math.round((margin / revenue) * 100) : null, budgetUsedPct: p.budgetCents ? Math.round((p.costToDateCents / p.budgetCents) * 100) : null, alerts };
  }
  let score = 100;

  // Schedule: where should progress be today given start → target?
  let expected: number | null = null;
  const start = p.startDate ?? p.createdAt;
  if (p.targetDate) {
    const total = p.targetDate.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    expected = total > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / total) * 100))) : 100;
    const daysLeft = Math.ceil((p.targetDate.getTime() - now.getTime()) / DAY);
    if (daysLeft < 0 && p.progress < 100) {
      score -= 35;
      alerts.push({ level: "danger", kind: "schedule", msg: ["Target date passed {n} days ago — {progress}% done", { n: -daysLeft, progress: p.progress }] });
    } else if (expected - p.progress >= 25) {
      score -= 25;
      alerts.push({ level: "danger", kind: "schedule", msg: ["Behind schedule: {progress}% done, {expected}% expected by now", { progress: p.progress, expected }] });
    } else if (expected - p.progress >= 10) {
      score -= 12;
      alerts.push({ level: "warning", kind: "schedule", msg: ["Slightly behind: {progress}% done, {expected}% expected", { progress: p.progress, expected }] });
    }
    if (daysLeft >= 0 && daysLeft <= 7 && p.progress < 90) alerts.push({ level: "warning", kind: "schedule", msg: ["Delivery in {n} days with {progress}% done", { n: daysLeft, progress: p.progress }] });
  }

  // Tasks
  if (p.overdueTasks > 0) {
    score -= Math.min(20, 4 * p.overdueTasks);
    alerts.push({ level: p.overdueTasks >= 5 ? "danger" : "warning", kind: "tasks", msg: p.overdueTasks === 1 ? "1 overdue task" : ["{n} overdue tasks", { n: p.overdueTasks }] });
  }
  if (p.blockedTasks > 0) {
    score -= Math.min(10, 3 * p.blockedTasks);
    alerts.push({ level: "warning", kind: "tasks", msg: p.blockedTasks === 1 ? "1 blocked task" : ["{n} blocked tasks", { n: p.blockedTasks }] });
  }

  // Budget: consumed and forecast at completion (cost so far extrapolated by progress, or planned cost).
  let forecast: number | null = null;
  let usedPct: number | null = null;
  if (p.budgetCents && p.budgetCents > 0) {
    usedPct = Math.round((p.costToDateCents / p.budgetCents) * 100);
    // Extrapolating cost by progress is meaningless at the very start of a project.
    const byProgress = p.progress >= 20 ? Math.round(p.costToDateCents / (p.progress / 100)) : null;
    forecast = Math.max(byProgress ?? 0, p.plannedCostCents, p.costToDateCents);
    if (p.costToDateCents > p.budgetCents) {
      score -= 25;
      alerts.push({ level: "danger", kind: "budget", msg: ["Budget exceeded: {used}% consumed", { used: usedPct }] });
    } else if (forecast > p.budgetCents * 1.5) {
      score -= 25;
      alerts.push({ level: "danger", kind: "budget", msg: ["Overrun risk: forecast {pct}% of budget", { pct: Math.round((forecast / p.budgetCents) * 100) }] });
    } else if (forecast > p.budgetCents * 1.05) {
      score -= 15;
      alerts.push({ level: "warning", kind: "budget", msg: ["Overrun risk: forecast {pct}% of budget", { pct: Math.round((forecast / p.budgetCents) * 100) }] });
    } else if (usedPct >= 80 && p.progress < 70) {
      score -= 10;
      alerts.push({ level: "warning", kind: "budget", msg: ["{used}% of budget used for {progress}% of progress", { used: usedPct, progress: p.progress }] });
    }
  }

  // Client: approvals and requests blocked on their side.
  const longest = p.clientWaits.reduce((m, w) => Math.max(m, w.days), 0);
  if (p.clientWaits.length) {
    score -= longest >= 7 ? 15 : 6;
    alerts.push({ level: longest >= 7 ? "danger" : "warning", kind: "client", msg: ["Waiting on the client: {n} item(s), longest {days} d", { n: p.clientWaits.length, days: longest }] });
  }
  if (p.pendingApprovals > 0) alerts.push({ level: "info", kind: "client", msg: ["{n} deliverable(s) awaiting client approval", { n: p.pendingApprovals }] });
  if (p.openChangeRequests > 0) alerts.push({ level: "info", kind: "client", msg: ["{n} open change request(s)", { n: p.openChangeRequests }] });

  // Cash
  if (p.overdueInvoiceCents > 0) {
    score -= 8;
    alerts.push({ level: "warning", kind: "cash", msg: "Overdue invoice payments" });
  }

  // Revenue = the project's budget (agreed price), or what has been invoiced if that's more.
  const base = Math.max(p.budgetCents ?? 0, p.invoicedCents);
  const margin = base ? base - (forecast ?? p.costToDateCents) : null;
  score = Math.max(0, Math.min(100, score));
  const status = score >= 75 ? "on_track" : score >= 50 ? "at_risk" : "off_track";
  const order = { danger: 0, warning: 1, info: 2 } as const;
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  return { score, status, expectedProgress: expected, forecastCostCents: forecast, marginCents: margin, marginPct: margin !== null && base ? Math.round((margin / base) * 100) : null, budgetUsedPct: usedPct, alerts };
}

export const HEALTH_LABEL = { on_track: "On track", at_risk: "At risk", off_track: "Off track", done: "Completed" } as const;
export const HEALTH_TONE = { on_track: "success", at_risk: "warning", off_track: "danger", done: "neutral" } as const;
