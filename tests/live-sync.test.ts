import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { GET } from "@/app/api/live/route";
import { makeWorkspace, makeUser, signIn } from "./helpers";

const stamp = async (p?: string) => {
  const r = await GET(new NextRequest(`http://localhost/api/live${p ? `?p=${p}` : ""}`));
  return { status: r.status, s: ((await r.json()) as { s?: string }).s };
};

describe("live sync fingerprint", () => {
  it("changes for the client on shared files but not on internal ones", async () => {
    const { ws, client, project } = await makeWorkspace();
    await db.project.update({ where: { id: project.id }, data: { portalEnabled: true } });
    const portalUser = await makeUser("Client");
    await db.clientPortalAccess.create({ data: { workspaceId: ws.id, clientId: client.id, userId: portalUser.id } });
    await signIn(portalUser.id);
    const a = await stamp();
    expect(a.status).toBe(200);

    await db.file.create({ data: { workspaceId: ws.id, projectId: project.id, name: "internal.pdf", mimeType: "application/pdf", status: "READY", visibility: "INTERNAL" } });
    expect((await stamp()).s).toBe(a.s);

    await db.file.create({ data: { workspaceId: ws.id, projectId: project.id, name: "shared.pdf", mimeType: "application/pdf", status: "READY", visibility: "CLIENT_VISIBLE" } });
    expect((await stamp()).s).not.toBe(a.s);
  });

  it("refuses a project the member cannot access", async () => {
    const a = await makeWorkspace();
    const b = await makeWorkspace();
    await signIn(a.owner.id, { workspaceId: a.ws.id });
    expect((await stamp(b.project.id)).status).toBe(404);
    expect((await stamp(a.project.id)).status).toBe(200);
  });
});
