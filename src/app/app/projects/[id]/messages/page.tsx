import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { MessageThread } from "@/components/app/messages";
import { getT } from "@/lib/i18n/server";

const CONTEXT: Record<string, string> = { TASK: "on a task", DELIVERABLE: "on a deliverable", FILE: "on a file", INVOICE: "on an invoice" };

export default async function ProjectMessages({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, perms } = await loadProject(id);
  const messages = await db.message.findMany({ where: { workspaceId: ctx.workspace.id, projectId: id }, orderBy: { createdAt: "asc" }, take: 300 });
  const t = await getT();
  return (
    <div className="max-w-3xl">
      <MessageThread
        messages={messages.map((m) => ({ ...m, context: CONTEXT[m.entityType] ? t(CONTEXT[m.entityType]!) : null }))}
        projectId={id}
        canPost={hasLevel(perms, "messages", "view")}
        allowClientVisible={hasLevel(perms, "messages", "send")}
      />
    </div>
  );
}
