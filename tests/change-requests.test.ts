import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace, makeUser, signIn, fd } from "./helpers";
import { cookieJar } from "./setup";
import { createChangeRequestAction, updateChangeRequestAction } from "@/server/actions/change-requests";
import { translate, translateMessage } from "@/lib/i18n/core";

async function portalUser(a: Awaited<ReturnType<typeof makeWorkspace>>) {
  const user = await makeUser("Client");
  await db.clientPortalAccess.create({ data: { workspaceId: a.ws.id, clientId: a.client.id, userId: user.id } });
  return user;
}

describe("client change requests", () => {
  it("records subject, page and feedback, and notifies the project team", async () => {
    const a = await makeWorkspace();
    const user = await portalUser(a);
    await signIn(user.id, { portalClientId: a.client.id });
    const r = await createChangeRequestAction(fd({ projectId: a.project.id, subject: "CONTENT", page: "__other", pageOther: "Contact", message: "Change the phone number" }));
    expect(r.ok).toBe(true);
    const cr = await db.changeRequest.findFirstOrThrow({ where: { projectId: a.project.id } });
    expect(cr).toMatchObject({ subject: "CONTENT", page: "Contact", status: "OPEN", clientId: a.client.id });
    const n = await db.notification.findFirst({ where: { userId: a.owner.id, type: "CLIENT_CHANGE_REQUEST" } });
    expect(n?.actionUrl).toContain(`/app/projects/${a.project.id}/requests`);
  });

  it("a client cannot file a request on another client's project", async () => {
    const a = await makeWorkspace();
    const b = await makeWorkspace();
    const user = await portalUser(a);
    await signIn(user.id, { portalClientId: a.client.id });
    const r = await createChangeRequestAction(fd({ projectId: b.project.id, subject: "DESIGN", message: "x" }));
    expect(r.ok).toBe(false);
    expect(await db.changeRequest.count({ where: { projectId: b.project.id } })).toBe(0);
  });

  it("the team answers, can create a task, and the client is notified; other workspaces get 404", async () => {
    const a = await makeWorkspace();
    const b = await makeWorkspace();
    const user = await portalUser(a);
    const cr = await db.changeRequest.create({ data: { workspaceId: a.ws.id, projectId: a.project.id, clientId: a.client.id, authorName: "Client", subject: "BUG", message: "Menu broken" } });
    await signIn(b.owner.id, { workspaceId: b.ws.id });
    expect((await updateChangeRequestAction(fd({ id: cr.id, status: "DONE" }))).ok).toBe(false);
    await signIn(a.owner.id, { workspaceId: a.ws.id });
    const r = await updateChangeRequestAction(fd({ id: cr.id, status: "IN_PROGRESS", response: "On it", createTask: "on" }));
    expect(r.ok).toBe(true);
    const updated = await db.changeRequest.findUniqueOrThrow({ where: { id: cr.id } });
    expect(updated.status).toBe("IN_PROGRESS");
    expect(updated.taskId).toBeTruthy();
    expect(await db.notification.count({ where: { userId: user.id, type: "CHANGE_REQUEST_UPDATED" } })).toBe(1);
  });
});

describe("i18n", () => {
  it("translates messages, placeholders and validation labels", () => {
    expect(translate("fr", "Due {date}", { date: "1 oct." })).toBe("Échéance 1 oct.");
    expect(translate("fr", "Unknown key stays")).toBe("Unknown key stays");
    expect(translateMessage("fr", "Title is required.")).toBe("Le titre est obligatoire.");
    expect(translateMessage("fr", "Project name is required.")).toBe("Le nom du projet est obligatoire.");
  });

  it("server actions answer in the visitor's language", async () => {
    const a = await makeWorkspace();
    await signIn(a.owner.id, { workspaceId: a.ws.id });
    cookieJar.set("vmw_locale", "fr");
    const r = await updateChangeRequestAction(fd({ id: "00000000-0000-4000-8000-000000000000", status: "DONE" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Introuvable.");
  });
});
