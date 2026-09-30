import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createPortalLinkAction, createClientAction } from "@/server/actions/clients";
import { acceptInvitationAction } from "@/server/actions/team";
import { makeWorkspace, makeUser, addMember, signIn, fd } from "./helpers";

describe("portal access links (WhatsApp / link, no email)", () => {
  it("creates a single-use link that any signed-in account can accept", async () => {
    const { ws, owner, client } = await makeWorkspace();
    await signIn(owner.id, { workspaceId: ws.id });
    const r = await createPortalLinkAction(fd({ clientId: client.id, channel: "whatsapp" }));
    expect(r.ok).toBe(true);
    const link = (r as { data: { link: string } }).data.link;
    const token = link.split("/invite/")[1]!;

    const stranger = await makeUser("Client by WhatsApp"); // any email, not the client's
    await signIn(stranger.id);
    const a = await acceptInvitationAction(token);
    expect(a.ok).toBe(true);
    expect(await db.clientPortalAccess.count({ where: { clientId: client.id, userId: stranger.id, revokedAt: null } })).toBe(1);

    // Single use.
    const other = await makeUser("Someone else");
    await signIn(other.id);
    expect((await acceptInvitationAction(token)).ok).toBe(false);
  });

  it("requires the clients:edit permission to create a link", async () => {
    const { ws, client } = await makeWorkspace();
    const { user: viewer } = await addMember(ws.id, "VIEWER");
    await signIn(viewer.id, { workspaceId: ws.id });
    expect((await createPortalLinkAction(fd({ clientId: client.id }))).ok).toBe(false);
  });

  it("lets a client be created with a phone number and no email", async () => {
    const { ws, owner } = await makeWorkspace();
    await signIn(owner.id, { workspaceId: ws.id });
    const r = await createClientAction(fd({ firstName: "Nadia", phone: "+33 6 12 34 56 78", currency: "EUR", preferredLanguage: "fr" }));
    expect(r.ok).toBe(true);
    const c = await db.client.findFirst({ where: { workspaceId: ws.id, firstName: "Nadia" } });
    expect(c?.email).toBe("");
    expect(c?.phone).toBe("+33 6 12 34 56 78");
  });
});
