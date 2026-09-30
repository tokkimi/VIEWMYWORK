import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, portalProjectWhere } from "@/lib/auth/portal";
import { EmptyState } from "@/components/ui/primitives";
import { MessageThread } from "@/components/app/messages";
import { postPortalMessageAction } from "@/server/actions/portal";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Messages" };

export default async function PortalMessages() {
  const ctx = await requirePortal();
  const projects = await db.project.findMany({ where: portalProjectWhere(ctx), orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });
  if (!projects.length) return <><h1 className="mb-6 text-2xl font-semibold tracking-tight">Messages</h1><EmptyState icon={<MessageSquare />} title="No conversations yet" /></>;
  if (projects.length === 1) {
    const messages = await db.message.findMany({ where: { workspaceId: ctx.workspace.id, projectId: projects[0].id, visibility: "CLIENT_VISIBLE", entityType: { in: ["PROJECT", "DELIVERABLE", "INVOICE"] } }, orderBy: { createdAt: "asc" }, take: 300 });
    return (
      <>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Messages</h1>
        <div className="max-w-3xl"><MessageThread portal messages={messages} projectId={projects[0].id} canPost action={postPortalMessageAction} allowClientVisible={false} /></div>
      </>
    );
  }
  const last = await Promise.all(projects.map((p) => db.message.findFirst({ where: { projectId: p.id, visibility: "CLIENT_VISIBLE" }, orderBy: { createdAt: "desc" } })));
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Messages</h1>
      <ul className="panel divide-y divide-line rounded-2xl">
        {projects.map((p, i) => (
          <li key={p.id}>
            <Link href={`/portal/projects/${p.id}/messages`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
              <div className="min-w-0 flex-1"><div className="text-sm font-medium">{p.name}</div><div className="truncate text-xs text-muted">{last[i] ? `${last[i]!.authorName}: ${last[i]!.body}` : "No messages yet"}</div></div>
              {last[i] && <span className="text-[11px] text-subtle">{relativeTime(last[i]!.createdAt)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
