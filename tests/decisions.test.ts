import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { reminderDue, manualReminderAllowed, DEFAULT_REMINDERS } from "@/lib/decisions";
import { createScopeChangeAction } from "@/server/actions/projects";
import { decideScopeAsClientAction } from "@/server/actions/portal";
import { remindClientAction } from "@/server/actions/decisions";
import { loadDecisions } from "@/server/queries/decisions";
import { runDecisionReminders } from "@/server/services/daily";
import { makeWorkspace, makeUser, signIn, plan, fd } from "./helpers";

const DAY = 86_400_000;

async function enable(key: string) {
  const p = await plan();
  await db.planFeature.upsert({ where: { planId_key: { planId: p.id, key } }, create: { planId: p.id, key, enabled: true }, update: { enabled: true } });
}

async function withPortalClient() {
  const w = await makeWorkspace();
  const portalUser = await makeUser("Client user");
  await db.clientPortalAccess.create({ data: { workspaceId: w.ws.id, clientId: w.client.id, userId: portalUser.id } });
  return { ...w, portalUser };
}

describe("reminder rules", () => {
  const now = new Date("2026-05-20T09:00:00Z");
  const item = (days: number, reminders = 0, lastDays: number | null = null) => ({ kind: "APPROVAL" as const, since: new Date(now.getTime() - days * DAY), reminders, lastReminderAt: lastDays === null ? null : new Date(now.getTime() - lastDays * DAY) });

  it("waits for the first delay, then repeats on schedule up to the max", () => {
    expect(reminderDue(item(2), DEFAULT_REMINDERS, now)).toBe(false);
    expect(reminderDue(item(3), DEFAULT_REMINDERS, now)).toBe(true);
    expect(reminderDue(item(6, 1, 3), DEFAULT_REMINDERS, now)).toBe(false);
    expect(reminderDue(item(7, 1, 4), DEFAULT_REMINDERS, now)).toBe(true);
    expect(reminderDue(item(30, 3, 10), DEFAULT_REMINDERS, now)).toBe(false);
  });

  it("never auto-reminds invoices or when disabled", () => {
    expect(reminderDue({ ...item(10), kind: "PAYMENT" }, DEFAULT_REMINDERS, now)).toBe(false);
    expect(reminderDue(item(10), { ...DEFAULT_REMINDERS, enabled: false }, now)).toBe(false);
  });

  it("allows a manual reminder at most about once a day", () => {
    expect(manualReminderAllowed(null, now)).toBe(true);
    expect(manualReminderAllowed(new Date(now.getTime() - 5 * 3600_000), now)).toBe(false);
    expect(manualReminderAllowed(new Date(now.getTime() - 21 * 3600_000), now)).toBe(true);
  });
});

describe("client scope arbitration", () => {
  it("lets the client accept: task created, deadline and budget updated, decision recorded once", async () => {
    const { ws, owner, client, project, portalUser } = await withPortalClient();
    const target = new Date("2026-12-01T00:00:00Z");
    await db.project.update({ where: { id: project.id }, data: { targetDate: target, budgetCents: 100_000 } });
    await signIn(owner.id, { workspaceId: ws.id });
    expect((await createScopeChangeAction(fd({ projectId: project.id, description: "Extra blog page", requestedBy: "Client", additionalCost: "500", additionalDays: 5, askClient: "on" }))).ok).toBe(true);
    const sc = await db.scopeChange.findFirstOrThrow({ where: { projectId: project.id } });
    expect(sc.askClient).toBe(true);
    expect((await loadDecisions(ws.id)).some((i) => i.key === `scope:${sc.id}` && i.kind === "SCOPE")).toBe(true);

    await signIn(portalUser.id, { portalClientId: client.id });
    const r = await decideScopeAsClientAction(fd({ id: sc.id, decision: "APPROVED", comment: "Go" }));
    expect(r.ok).toBe(true);
    const after = await db.scopeChange.findUniqueOrThrow({ where: { id: sc.id } });
    expect(after.status).toBe("APPROVED");
    expect(after.clientComment).toBe("Go");
    const p = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(p.targetDate!.getTime()).toBe(target.getTime() + 5 * DAY);
    expect(p.budgetCents).toBe(150_000);
    expect(await db.task.count({ where: { projectId: project.id, title: "Extra blog page", visibility: "CLIENT_VISIBLE" } })).toBe(1);
    expect((await decideScopeAsClientAction(fd({ id: sc.id, decision: "REJECTED" }))).ok).toBe(false);
    expect((await loadDecisions(ws.id)).some((i) => i.key === `scope:${sc.id}`)).toBe(false);
  });

  it("refuses another client's scope change and changes not sent to the client", async () => {
    const a = await withPortalClient();
    const b = await withPortalClient();
    const sc = await db.scopeChange.create({ data: { projectId: a.project.id, description: "X", requestedBy: "Team", askClient: true } });
    const internal = await db.scopeChange.create({ data: { projectId: b.project.id, description: "Y", requestedBy: "Team", askClient: false } });
    await signIn(b.portalUser.id, { portalClientId: b.client.id });
    expect((await decideScopeAsClientAction(fd({ id: sc.id, decision: "APPROVED" }))).ok).toBe(false);
    expect((await decideScopeAsClientAction(fd({ id: internal.id, decision: "APPROVED" }))).ok).toBe(false);
    expect((await db.scopeChange.findUniqueOrThrow({ where: { id: sc.id } })).status).toBe("PROPOSED");
  });
});

describe("client reminders", () => {
  it("reminds manually once a day and refuses clients without portal access", async () => {
    await enable("client_decisions");
    const { ws, owner, client, project, portalUser } = await withPortalClient();
    await db.clientWait.create({ data: { projectId: project.id, label: "Logo files", reason: "DOCUMENT", startedAt: new Date(Date.now() - 5 * DAY) } });
    await signIn(owner.id, { workspaceId: ws.id });
    const r = await remindClientAction(client.id);
    expect(r.ok).toBe(true);
    expect(await db.clientReminder.count({ where: { clientId: client.id, auto: false } })).toBe(1);
    expect(await db.notification.count({ where: { userId: portalUser.id, type: "DECISION_REMINDER" } })).toBe(1);
    expect((await remindClientAction(client.id)).ok).toBe(false); // throttled

    const other = await db.client.create({ data: { workspaceId: ws.id, firstName: "No", lastName: "Portal", email: "np@client.dev" } });
    const p2 = await db.project.create({ data: { workspaceId: ws.id, clientId: other.id, name: "P2" } });
    await db.clientWait.create({ data: { projectId: p2.id, label: "Brief", reason: "INFORMATION" } });
    const n = await remindClientAction(other.id);
    expect(n.ok).toBe(false);
  });

  it("sends automatic grouped reminders once due, then respects the interval", async () => {
    await enable("client_decisions");
    const { project, client } = await withPortalClient();
    await db.clientWait.create({ data: { projectId: project.id, label: "Texts", reason: "DOCUMENT", startedAt: new Date(Date.now() - 4 * DAY) } });
    await db.clientWait.create({ data: { projectId: project.id, label: "Access", reason: "INFORMATION", startedAt: new Date(Date.now() - 1 * DAY) } });
    await runDecisionReminders();
    const logs = await db.clientReminder.findMany({ where: { clientId: client.id } });
    expect(logs.length).toBe(1); // only the item older than 3 days
    expect(logs[0]!.auto).toBe(true);
    await runDecisionReminders();
    expect(await db.clientReminder.count({ where: { clientId: client.id } })).toBe(1);
  });
});
