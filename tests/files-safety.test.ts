import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { deleteFileAction, restoreFileAction } from "@/server/actions/files";
import { putObject, headObject } from "@/lib/storage";
import { clientCanReadFile } from "@/server/services/files";
import { makeWorkspace, makeUser, signIn } from "./helpers";

describe("files never silently disappear", () => {
  it("delete keeps the bytes; restore brings the file back", async () => {
    const { ws, owner, project } = await makeWorkspace();
    const key = `ws/${ws.id}/${crypto.randomUUID()}/brief.pdf`;
    await putObject(key, Buffer.from("%PDF-1.4 test"), "application/pdf");
    const f = await db.file.create({ data: { workspaceId: ws.id, projectId: project.id, name: "brief.pdf", mimeType: "application/pdf", sizeBytes: 13n, storageKey: key, status: "READY", visibility: "CLIENT_VISIBLE" } });
    await signIn(owner.id, { workspaceId: ws.id });

    expect((await deleteFileAction(f.id)).ok).toBe(true);
    expect((await db.file.findUnique({ where: { id: f.id } }))?.deletedAt).not.toBeNull();
    expect((await headObject(key)).size).toBe(13); // still stored

    expect((await restoreFileAction(f.id)).ok).toBe(true);
    expect((await db.file.findUnique({ where: { id: f.id } }))?.deletedAt).toBeNull();
    expect(await db.activityLog.count({ where: { entityId: f.id, action: { in: ["FILE_DELETED", "FILE_RESTORED"] } } })).toBe(2);
  });

  it("a document attached to the client (no project) is readable by that client's portal user", async () => {
    const { ws, client } = await makeWorkspace();
    const u = await makeUser("Client");
    await db.clientPortalAccess.create({ data: { workspaceId: ws.id, clientId: client.id, userId: u.id } });
    const f = await db.file.create({ data: { workspaceId: ws.id, clientId: client.id, name: "contrat.pdf", mimeType: "application/pdf", status: "READY", visibility: "CLIENT_VISIBLE" } });
    expect(await clientCanReadFile(u.id, f)).toBe(true);
    const internal = await db.file.update({ where: { id: f.id }, data: { visibility: "INTERNAL" } });
    expect(await clientCanReadFile(u.id, internal)).toBe(false);
  });
});
