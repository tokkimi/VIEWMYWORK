import { describe, it, expect } from "vitest";
import { memberWeeks, spread, remainingMinutes, suggestAssignees, weekStart, availableDays, DEFAULT_TASK_MINUTES } from "@/lib/workload";
import { projectHealth, type HealthInput } from "@/lib/health";

const D = (s: string) => new Date(`${s}T12:00:00Z`);
const mon = D("2026-10-05"); // a Monday

describe("workload engine", () => {
  it("weeks start on Monday", () => {
    expect(weekStart(D("2026-10-08")).toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(weekStart(D("2026-10-11")).toISOString().slice(0, 10)).toBe("2026-10-05"); // Sunday
  });

  it("remaining effort: estimate minus time spent, default when not estimated, 0 when closed", () => {
    expect(remainingMinutes({ id: "a", assigneeId: null, status: "IN_PROGRESS", startDate: null, deadline: null, estimatedMinutes: 600, actualMinutes: 240 })).toBe(360);
    expect(remainingMinutes({ id: "a", assigneeId: null, status: "NOT_STARTED", startDate: null, deadline: null, estimatedMinutes: null, actualMinutes: null })).toBe(DEFAULT_TASK_MINUTES);
    expect(remainingMinutes({ id: "a", assigneeId: null, status: "COMPLETED", startDate: null, deadline: null, estimatedMinutes: 600, actualMinutes: 0 })).toBe(0);
    expect(remainingMinutes({ id: "a", assigneeId: null, status: "IN_PROGRESS", startDate: null, deadline: null, estimatedMinutes: 600, actualMinutes: 0, hasSubtasks: true })).toBe(0);
  });

  it("spreads effort over working days until the deadline; overdue work lands today", () => {
    const s = spread({ id: "a", assigneeId: "u", status: "NOT_STARTED", startDate: null, deadline: D("2026-10-09"), estimatedMinutes: 500, actualMinutes: 0 }, mon);
    expect(s.size).toBe(5);
    expect([...s.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(500);
    const o = spread({ id: "b", assigneeId: "u", status: "NOT_STARTED", startDate: null, deadline: D("2026-09-30"), estimatedMinutes: 300, actualMinutes: 0 }, mon);
    expect([...o.entries()]).toEqual([[Date.UTC(2026, 9, 5), 300]]);
  });

  it("absences reduce capacity and utilisation is load / capacity", () => {
    const absences = [{ memberUserId: "u", startDate: D("2026-10-08"), endDate: D("2026-10-09") }];
    expect(availableDays(weekStart(mon), absences).length).toBe(3);
    const w = memberWeeks({ tasks: [{ id: "a", assigneeId: "u", status: "NOT_STARTED", startDate: null, deadline: D("2026-10-09"), estimatedMinutes: 1260, actualMinutes: 0 }], weeklyCapacityMinutes: 2100, absences, today: mon, weeks: 2 });
    expect(w[0]!.capacity).toBe(1260);
    expect(w[0]!.load).toBe(1260);
    expect(w[0]!.utilization).toBe(100);
    expect(w[1]!.load).toBe(0);
  });

  it("suggests the least loaded member who has access to the project", () => {
    const busy = { userId: "busy", weeklyCapacityMinutes: 2100, absences: [], projectIds: "all" as const, tasks: [{ id: "x", assigneeId: "busy", status: "IN_PROGRESS", startDate: null, deadline: D("2026-10-09"), estimatedMinutes: 2000, actualMinutes: 0 }] };
    const free = { userId: "free", weeklyCapacityMinutes: 2100, absences: [], projectIds: new Set(["p1"]), tasks: [] };
    const outsider = { userId: "out", weeklyCapacityMinutes: 2100, absences: [], projectIds: new Set(["other"]), tasks: [] };
    const r = suggestAssignees([{ id: "t1", projectId: "p1", assigneeId: null, status: "NOT_STARTED", startDate: null, deadline: D("2026-10-09"), estimatedMinutes: 240, actualMinutes: 0 }], [busy, free, outsider], mon);
    expect(r.get("t1")).toBe("free");
  });
});

const base: HealthInput = {
  status: "ACTIVE", progress: 50, startDate: D("2026-09-01"), targetDate: D("2026-10-31"), createdAt: D("2026-09-01"),
  overdueTasks: 0, openTasks: 10, blockedTasks: 0, budgetCents: 1_000_000, costToDateCents: 400_000, plannedCostCents: 700_000,
  invoicedCents: 500_000, paidCents: 500_000, overdueInvoiceCents: 0, clientWaits: [], pendingApprovals: 0, openChangeRequests: 0, nextDeadline: null,
};

describe("project health engine", () => {
  it("a project on time and on budget is on track", () => {
    const h = projectHealth(base, D("2026-10-01"));
    expect(h.status).toBe("on_track");
    expect(h.alerts.filter((a) => a.level !== "info")).toHaveLength(0);
    expect(h.budgetUsedPct).toBe(40);
  });

  it("flags lateness, overdue tasks and long client waits", () => {
    const h = projectHealth({ ...base, progress: 20, overdueTasks: 3, clientWaits: [{ days: 12 }] }, D("2026-10-15"));
    expect(h.status).toBe("off_track");
    expect(h.alerts.map((a) => a.kind)).toEqual(expect.arrayContaining(["schedule", "tasks", "client"]));
    expect(h.alerts[0]!.level).toBe("danger");
  });

  it("forecasts a budget overrun from cost so far and progress", () => {
    const h = projectHealth({ ...base, progress: 30, costToDateCents: 450_000 }, D("2026-09-20"));
    expect(h.forecastCostCents).toBe(1_500_000);
    expect(h.alerts.some((a) => a.kind === "budget")).toBe(true);
  });

  it("finished projects are 'done' with their real margin", () => {
    const h = projectHealth({ ...base, status: "COMPLETED", budgetCents: 1_000_000, invoicedCents: 1_000_000, costToDateCents: 600_000 });
    expect(h.status).toBe("done");
    expect(h.marginPct).toBe(40);
  });
});

describe("project health severity", () => {
  it("a forecast far above budget is critical, and margin uses the agreed price", () => {
    const h = projectHealth({ ...base, progress: 40, costToDateCents: 800_000, budgetCents: 1_000_000, invoicedCents: 300_000 }, D("2026-10-01"));
    expect(h.forecastCostCents).toBe(2_000_000);
    expect(h.alerts.find((a) => a.kind === "budget")?.level).toBe("danger");
    expect(h.marginCents).toBe(1_000_000 - 2_000_000);
    expect(h.status).not.toBe("on_track");
  });
});
