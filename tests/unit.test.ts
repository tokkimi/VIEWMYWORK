import { describe, expect, it } from "vitest";
import { calcInvoice, calcLine } from "@/lib/invoices/calc";
import { deriveStatus, isOverdue, outstandingCents } from "@/lib/invoices/status";
import { formatInvoiceNumber } from "@/lib/invoices/numbering";
import { projectProgress, phaseProgress } from "@/lib/progress";
import { parseMoneyToCents } from "@/lib/money";
import { resolvePermissions, hasLevel, sanitizePermissions } from "@/lib/auth/permissions";

describe("invoice calculations", () => {
  it("computes line totals with tax and discount in integer cents", () => {
    const l = calcLine({ description: "x", quantity: 1.5, unitPriceCents: 8000, taxRateBps: 2000, discountBps: 1000 });
    expect(l.gross).toBe(12000);
    expect(l.discount).toBe(1200);
    expect(l.lineSubtotal).toBe(10800);
    expect(l.lineTax).toBe(2160);
    expect(l.lineTotal).toBe(12960);
  });
  it("never drifts with floating point (0.1 + 0.2 style inputs)", () => {
    const t = calcInvoice([
      { description: "a", quantity: 3, unitPriceCents: 10, taxRateBps: 2000 },
      { description: "b", quantity: 0.333, unitPriceCents: 999, taxRateBps: 550 },
    ]);
    expect(Number.isInteger(t.totalCents)).toBe(true);
    expect(t.totalCents).toBe(t.subtotalCents + t.taxCents);
    expect(t.taxBreakdown.map((x) => x.rateBps).sort()).toEqual([2000, 550].sort());
  });
  it("parses user-entered amounts", () => {
    expect(parseMoneyToCents("1 200,50")).toBe(120050);
    expect(parseMoneyToCents("1200.5")).toBe(120050);
    expect(parseMoneyToCents("€1,200")).toBe(120000);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
});

describe("invoice status", () => {
  const base = { status: "SENT" as const, totalCents: 200000, paidCents: 0, refundedCents: 0, dueDate: new Date("2026-09-01") };
  const now = new Date("2026-09-30");
  it("derives OVERDUE from due date and outstanding balance", () => {
    expect(deriveStatus(base, now)).toBe("OVERDUE");
    expect(isOverdue({ ...base, dueDate: new Date("2026-09-30") }, now)).toBe(false);
  });
  it("partially paid then paid", () => {
    expect(deriveStatus({ ...base, dueDate: new Date("2026-10-30"), paidCents: 80000 }, now)).toBe("PARTIALLY_PAID");
    expect(outstandingCents({ totalCents: 200000, paidCents: 80000 })).toBe(120000);
    expect(deriveStatus({ ...base, paidCents: 200000 }, now)).toBe("PAID");
  });
  it("drafts and voids are never overdue", () => {
    expect(deriveStatus({ ...base, status: "DRAFT" }, now)).toBe("DRAFT");
    expect(deriveStatus({ ...base, status: "VOID" }, now)).toBe("VOID");
  });
  it("formats invoice numbers", () => {
    expect(formatInvoiceNumber("INV", true, 2026, 42, 4)).toBe("INV-2026-0042");
    expect(formatInvoiceNumber("F", false, 2026, 7, 3)).toBe("F-007");
  });
});

describe("progress engine", () => {
  it("weights phases: Σ phase progress × phase weight", () => {
    const done = (n: number) => Array.from({ length: n }, () => ({ weight: 1, status: "COMPLETED" as const }));
    const todo = (n: number) => Array.from({ length: n }, () => ({ weight: 1, status: "NOT_STARTED" as const }));
    const phases = [
      { weight: 10, status: "NOT_STARTED" as const, tasks: done(2) }, // 100%
      { weight: 25, status: "NOT_STARTED" as const, tasks: done(2) }, // 100%
      { weight: 45, status: "NOT_STARTED" as const, tasks: [...done(1), ...todo(1)] }, // 50%
      { weight: 15, status: "NOT_STARTED" as const, tasks: todo(2) },
      { weight: 5, status: "NOT_STARTED" as const, tasks: todo(1) },
    ];
    expect(projectProgress(phases)).toBe(Math.round(10 + 25 + 22.5));
  });
  it("uses subtasks and task weights", () => {
    expect(phaseProgress({ weight: 1, status: "NOT_STARTED", tasks: [{ weight: 3, status: "IN_PROGRESS", subtasks: [{ weight: 1, status: "COMPLETED" }, { weight: 1, status: "NOT_STARTED" }] }, { weight: 1, status: "COMPLETED" }] })).toBe((3 * 50 + 100) / 4);
  });
});

describe("permissions", () => {
  it("applies overrides but never restricts owners", () => {
    const p = resolvePermissions("COLLABORATOR", { finance: "view", invoices: "bogus" });
    expect(p.finance).toBe("view");
    expect(p.invoices).toBe("none");
    expect(resolvePermissions("OWNER", { finance: "none" }).finance).toBe("edit");
    expect(hasLevel(resolvePermissions("VIEWER"), "tasks", "edit")).toBe(false);
    expect(sanitizePermissions({ hacker: "all", tasks: "edit" })).toEqual({ tasks: "edit" });
  });
});
