import { db } from "@/lib/db";
import { emit } from "@/lib/events";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Records the first client view (VIEWED status + professional notification).
 * Views by workspace members are ignored so previewing never fakes a client view.
 */
export async function markInvoiceViewed(invoiceId: string, portalUserId: string | null) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.firstViewedAt || inv.status === "DRAFT" || inv.status === "VOID") return;
  const user = portalUserId ? { id: portalUserId } : await getSessionUser();
  if (user) {
    const member = await db.workspaceMember.findFirst({ where: { userId: user.id, workspaceId: inv.workspaceId } });
    if (member) return;
  }
  const updated = await db.invoice.updateMany({ where: { id: invoiceId, firstViewedAt: null }, data: { firstViewedAt: new Date(), ...(inv.status === "SENT" ? { status: "VIEWED" } : {}) } });
  if (updated.count === 0) return; // someone else recorded it first
  await emit({
    workspaceId: inv.workspaceId, type: "INVOICE_VIEWED", actor: null, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: inv.id,
    summary: ["Client viewed invoice {number}", { number: inv.number }],
    notify: { team: { kind: "workspace", capability: ["invoices", "view"] }, title: "Invoice viewed", message: ["Your client viewed {number}.", { number: inv.number }], actionUrl: `/app/invoices/${inv.id}`, actionLabel: "Open invoice" },
  });
}
