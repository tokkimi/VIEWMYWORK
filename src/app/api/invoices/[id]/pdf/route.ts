import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getWorkspaceCtx, can, isUuid } from "@/lib/auth/context";
import { invoicePdfResponse } from "@/server/services/invoice-pdf";
import { resolvePermissions, hasLevel } from "@/lib/auth/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inv = await db.invoice.findUnique({ where: { id }, select: { workspaceId: true, clientId: true, status: true } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Professional: must be a member of the owning workspace with invoice access.
  const ctx = await getWorkspaceCtx();
  let allowed = Boolean(ctx && ctx.workspace.id === inv.workspaceId && can(ctx, "invoices", "view"));
  if (!allowed) {
    const m = await db.workspaceMember.findFirst({ where: { userId: user.id, workspaceId: inv.workspaceId, status: "ACTIVE" } });
    if (m) {
      allowed = hasLevel(resolvePermissions(m.role, m.permissions), "invoices", "view");
    }
  }
  // Client: issued invoices of a client they have portal access to.
  if (!allowed && inv.status !== "DRAFT") {
    const access = await db.clientPortalAccess.findFirst({ where: { userId: user.id, clientId: inv.clientId, revokedAt: null } });
    allowed = Boolean(access);
  }
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return invoicePdfResponse(id);
}
