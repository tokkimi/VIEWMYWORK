import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { MessageThread } from "@/components/app/messages";
import { postPortalMessageAction } from "@/server/actions/portal";

export default async function PortalProjectMessages({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePortal();
  await getPortalProject(ctx, id);
  // Only client-visible messages on the project itself, deliverables and invoices are exposed.
  const messages = await db.message.findMany({ where: { workspaceId: ctx.workspace.id, projectId: id, visibility: "CLIENT_VISIBLE", entityType: { in: ["PROJECT", "DELIVERABLE", "INVOICE"] } }, orderBy: { createdAt: "asc" }, take: 300 });
  return (
    <div className="max-w-3xl">
      <MessageThread portal messages={messages} projectId={id} canPost action={postPortalMessageAction} allowClientVisible={false} />
    </div>
  );
}
