import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace, makeUser, signIn, fd } from "./helpers";
import { createDeliverableAction, submitDeliverableAction, newVersionAction } from "@/server/actions/deliverables";
import { decideDeliverableAction } from "@/server/actions/portal";
import { recalcProject } from "@/lib/progress";

describe("approvals", () => {
  it("keeps full history across versions and requires a comment for changes", async () => {
    const a = await makeWorkspace();
    const clientUser = await makeUser("Client");
    await db.clientPortalAccess.create({ data: { workspaceId: a.ws.id, clientId: a.client.id, userId: clientUser.id } });
    await signIn(a.owner.id, { workspaceId: a.ws.id });
    const c = await createDeliverableAction(fd({ projectId: a.project.id, title: "Homepage", requiresApproval: "on" }));
    if (!c.ok) throw new Error(c.error);
    const id = c.data.id;
    expect((await submitDeliverableAction(id)).ok).toBe(true);

    await signIn(clientUser.id, { portalClientId: a.client.id });
    expect((await decideDeliverableAction(fd({ deliverableId: id, version: 1, decision: "CHANGES_REQUESTED" }))).ok).toBe(false);
    expect((await decideDeliverableAction(fd({ deliverableId: id, version: 1, decision: "CHANGES_REQUESTED", comment: "Bigger logo" }))).ok).toBe(true);
    // cannot decide twice on the same version
    expect((await decideDeliverableAction(fd({ deliverableId: id, version: 1, decision: "APPROVED" }))).ok).toBe(false);

    await signIn(a.owner.id, { workspaceId: a.ws.id });
    expect((await newVersionAction(fd({ id, notes: "Logo enlarged" }))).ok).toBe(true);
    expect((await submitDeliverableAction(id)).ok).toBe(true);

    await signIn(clientUser.id, { portalClientId: a.client.id });
    expect((await decideDeliverableAction(fd({ deliverableId: id, version: 1, decision: "APPROVED" }))).ok).toBe(false); // stale version
    expect((await decideDeliverableAction(fd({ deliverableId: id, version: 2, decision: "APPROVED" }))).ok).toBe(true);

    const history = await db.approval.findMany({ where: { deliverableId: id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => [h.version, h.decision])).toEqual([[1, "CHANGES_REQUESTED"], [2, "APPROVED"]]);
    expect(history[0].comment).toBe("Bigger logo");
    expect((await db.deliverable.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
  });

  it("a client of another workspace cannot approve", async () => {
    const a = await makeWorkspace();
    const b = await makeWorkspace();
    const intruder = await makeUser("Intruder");
    await db.clientPortalAccess.create({ data: { workspaceId: b.ws.id, clientId: b.client.id, userId: intruder.id } });
    const d = await db.deliverable.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, title: "X", status: "WAITING_FOR_CLIENT" } });
    await signIn(intruder.id, { portalClientId: b.client.id });
    expect((await decideDeliverableAction(fd({ deliverableId: d.id, version: 1, decision: "APPROVED" }))).ok).toBe(false);
  });
});

describe("progress persistence", () => {
  it("recalculates and honours manual override", async () => {
    const a = await makeWorkspace();
    const p1 = await db.phase.create({ data: { projectId: a.project.id, title: "A", position: 0, weight: 25 } });
    const p2 = await db.phase.create({ data: { projectId: a.project.id, title: "B", position: 1, weight: 75 } });
    await db.task.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, phaseId: p1.id, title: "t1", status: "COMPLETED" } });
    await db.task.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, phaseId: p2.id, title: "t2" } });
    expect(await recalcProject(db, a.project.id)).toBe(25);
    await db.project.update({ where: { id: a.project.id }, data: { progressMode: "MANUAL", manualProgress: 60 } });
    expect(await recalcProject(db, a.project.id)).toBe(60);
  });
});
