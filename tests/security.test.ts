import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace, addMember, signIn, fd, makeUser } from "./helpers";
import { updateTaskAction, addTaskAction } from "@/server/actions/spec";
import { createClientAction } from "@/server/actions/clients";
import { saveExpenseAction } from "@/server/actions/finance";
import { saveInvoiceAction } from "@/server/actions/invoices";
import { postMessageAction } from "@/server/actions/messages";
import { requestPortalUploadAction } from "@/server/actions/portal";
import { portalProjectHome, waitingForClient } from "@/server/queries/portal";
import { memberCanReadFile, clientCanReadFile } from "@/server/services/files";
import { acceptInvitationAction } from "@/server/actions/team";
import { randomToken, sha256 } from "@/lib/crypto";

describe("tenant isolation", () => {
  it("Workspace A cannot modify Workspace B's task via a forged id", async () => {
    const a = await makeWorkspace("A");
    const b = await makeWorkspace("B");
    const task = await db.task.create({ data: { workspaceId: b.ws.id, projectId: b.project.id, title: "B secret" } });
    await signIn(a.owner.id, { workspaceId: a.ws.id });
    const r = await updateTaskAction(fd({ id: task.id, title: "pwned" }));
    expect(r.ok).toBe(false);
    expect((await db.task.findUnique({ where: { id: task.id } }))!.title).toBe("B secret");
  });
  it("forging the workspace cookie does not grant access to another tenant", async () => {
    const a = await makeWorkspace("A");
    const b = await makeWorkspace("B");
    await signIn(a.owner.id, { workspaceId: b.ws.id }); // tampered hint
    const r = await addTaskAction(fd({ projectId: b.project.id, title: "inject" }));
    expect(r.ok).toBe(false);
    expect(await db.task.count({ where: { projectId: b.project.id } })).toBe(0);
  });
  it("cannot create an invoice for another tenant's client", async () => {
    const a = await makeWorkspace("A");
    const b = await makeWorkspace("B");
    await signIn(a.owner.id, { workspaceId: a.ws.id });
    const r = await saveInvoiceAction(fd({ clientId: b.client.id, currency: "EUR", issueDate: "2026-09-01", dueDate: "2026-10-01", lines: JSON.stringify([{ description: "x", quantity: 1, unitPrice: "10", taxRate: 0, discount: 0 }]) }));
    expect(r.ok).toBe(false);
  });
});

describe("authorization", () => {
  it("collaborator without finance permission cannot record expenses", async () => {
    const a = await makeWorkspace();
    const c = await addMember(a.ws.id, "COLLABORATOR", { projectIds: [a.project.id] });
    await signIn(c.user.id, { workspaceId: a.ws.id });
    const r = await saveExpenseAction(fd({ name: "x", category: "OTHER", amount: "10", currency: "EUR", date: "2026-09-01" }));
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
  it("collaborator cannot touch projects they are not assigned to", async () => {
    const a = await makeWorkspace();
    const other = await db.project.create({ data: { workspaceId: a.ws.id, clientId: a.client.id, name: "Other" } });
    const c = await addMember(a.ws.id, "COLLABORATOR", { projectIds: [a.project.id] });
    await signIn(c.user.id, { workspaceId: a.ws.id });
    expect((await addTaskAction(fd({ projectId: a.project.id, title: "ok" }))).ok).toBe(true);
    expect((await addTaskAction(fd({ projectId: other.id, title: "no" }))).ok).toBe(false);
  });
  it("viewer cannot create clients", async () => {
    const a = await makeWorkspace();
    const v = await addMember(a.ws.id, "VIEWER");
    await signIn(v.user.id, { workspaceId: a.ws.id });
    expect((await createClientAction(fd({ firstName: "x", email: "x@y.z", currency: "EUR" }))).ok).toBe(false);
  });
  it("collaborator cannot post client-visible messages without message permission", async () => {
    const a = await makeWorkspace();
    const c = await addMember(a.ws.id, "COLLABORATOR", { projectIds: [a.project.id] });
    await signIn(c.user.id, { workspaceId: a.ws.id });
    expect((await postMessageAction(fd({ projectId: a.project.id, body: "hi", visibility: "CLIENT_VISIBLE" }))).ok).toBe(false);
    expect((await postMessageAction(fd({ projectId: a.project.id, body: "note", visibility: "INTERNAL" }))).ok).toBe(true);
  });
});

describe("client visibility", () => {
  it("portal queries never return internal tasks, phases or files", async () => {
    const a = await makeWorkspace();
    const ph = await db.phase.create({ data: { projectId: a.project.id, title: "Visible", position: 0 } });
    await db.phase.create({ data: { projectId: a.project.id, title: "Internal phase", position: 1, visibility: "INTERNAL" } });
    await db.task.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, phaseId: ph.id, title: "Public task" } });
    await db.task.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, phaseId: ph.id, title: "Internal task", visibility: "INTERNAL", internalNotes: "margin 40%" } });
    await db.file.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, clientId: a.client.id, name: "internal.pdf", mimeType: "application/pdf", status: "READY", visibility: "INTERNAL" } });
    const home = await portalProjectHome(a.project.id);
    const json = JSON.stringify(home);
    expect(json).not.toContain("Internal task");
    expect(json).not.toContain("Internal phase");
    expect(json).not.toContain("internal.pdf");
    expect(json).not.toContain("margin");
    expect(json).toContain("Public task");
  });
  it("client cannot read internal files; members can", async () => {
    const a = await makeWorkspace();
    const clientUser = await makeUser("Client");
    await db.clientPortalAccess.create({ data: { workspaceId: a.ws.id, clientId: a.client.id, userId: clientUser.id } });
    const f = await db.file.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, clientId: a.client.id, name: "x.pdf", mimeType: "application/pdf", status: "READY", visibility: "INTERNAL" } });
    expect(await clientCanReadFile(clientUser.id, f)).toBe(false);
    expect(await memberCanReadFile(a.owner.id, f)).toBe(true);
    const shared = await db.file.update({ where: { id: f.id }, data: { visibility: "CLIENT_VISIBLE" } });
    expect(await clientCanReadFile(clientUser.id, shared)).toBe(true);
    const stranger = await makeUser("Stranger");
    expect(await clientCanReadFile(stranger.id, shared)).toBe(false);
    expect(await memberCanReadFile(stranger.id, shared)).toBe(false);
  });
  it("internal deliverables never appear in 'waiting for you'", async () => {
    const a = await makeWorkspace();
    await db.deliverable.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, title: "Hidden", status: "WAITING_FOR_CLIENT", visibility: "INTERNAL" } });
    const items = await waitingForClient(a.ws.id, a.client.id, [a.project.id]);
    expect(items.find((i) => i.title.startsWith("Hidden"))).toBeUndefined();
  });
  it("a portal user cannot upload into another client's project", async () => {
    const a = await makeWorkspace();
    const b = await makeWorkspace();
    const clientUser = await makeUser("Client");
    await db.clientPortalAccess.create({ data: { workspaceId: a.ws.id, clientId: a.client.id, userId: clientUser.id } });
    await signIn(clientUser.id, { portalClientId: a.client.id });
    const r = await requestPortalUploadAction({ name: "x.pdf", mimeType: "application/pdf", size: 10, target: { projectId: b.project.id } });
    expect(r.ok).toBe(false);
  });
});

describe("invitations", () => {
  it("only the invited email can accept, and only once", async () => {
    const a = await makeWorkspace();
    const invitee = await makeUser("Invitee");
    const other = await makeUser("Other");
    const token = randomToken();
    await db.invitation.create({ data: { workspaceId: a.ws.id, kind: "MEMBER", email: invitee.email, role: "COLLABORATOR", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 86400_000) } });
    await signIn(other.id);
    expect((await acceptInvitationAction(token)).ok).toBe(false);
    await signIn(invitee.id);
    expect((await acceptInvitationAction(token)).ok).toBe(true);
    expect((await acceptInvitationAction(token)).ok).toBe(false);
    expect(await db.workspaceMember.count({ where: { workspaceId: a.ws.id, userId: invitee.id } })).toBe(1);
  });
});
