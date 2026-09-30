import { notFound } from "next/navigation";
import { CheckCircle2, MessageSquareWarning, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { isUuid } from "@/lib/auth/context";
import { DeliverableStatusBadge } from "@/components/status";
import { FileGrid } from "@/components/app/files";
import { toFileDTO } from "@/lib/file-dto";
import { ReviewPanel } from "@/components/portal/review-panel";
import { MessageThread } from "@/components/app/messages";
import { postPortalMessageAction, markDeliverableViewed } from "@/server/actions/portal";
import { fmtDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";

export default async function ReviewDeliverable({ params }: { params: Promise<{ id: string; did: string }> }) {
  const { id, did } = await params;
  const ctx = await requirePortal();
  await getPortalProject(ctx, id);
  if (!isUuid(did)) notFound();
  const d = await db.deliverable.findFirst({
    where: { id: did, projectId: id, visibility: "CLIENT_VISIBLE", status: { not: "DRAFT" } },
    include: { versions: { where: { submittedAt: { not: null } }, orderBy: { version: "desc" }, include: { files: { where: { deletedAt: null, status: "READY", visibility: "CLIENT_VISIBLE" } } } }, approvals: { orderBy: { createdAt: "desc" } } },
  });
  if (!d) notFound();
  await markDeliverableViewed(d.id);
  const current = d.versions.find((v) => v.version === d.currentVersion) ?? d.versions[0];
  const messages = await db.message.findMany({ where: { workspaceId: ctx.workspace.id, entityType: "DELIVERABLE", entityId: d.id, visibility: "CLIENT_VISIBLE" }, orderBy: { createdAt: "asc" } });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{d.title}</h2><Badge>V{d.currentVersion}</Badge><DeliverableStatusBadge s={d.status} /></div>
          {d.description && <p className="mt-2 whitespace-pre-line text-sm text-muted">{d.description}</p>}
          {current?.notes && <p className="mt-3 rounded-xl border border-line p-3 text-sm"><span className="text-subtle">What&apos;s new in V{current.version}: </span>{current.notes}</p>}
          {current?.previewUrl && <a href={current.previewUrl} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"><ExternalLink className="size-4" />Open preview</a>}
        </div>
        {current && current.files.length > 0 && <FileGrid files={current.files.map(toFileDTO)} showVisibility={false} />}
        <section>
          <h3 className="mb-3 text-[13px] font-semibold">Discussion</h3>
          <MessageThread portal messages={messages} projectId={id} entityType="DELIVERABLE" entityId={d.id} canPost action={postPortalMessageAction} allowClientVisible={false} />
        </section>
      </div>
      <aside className="space-y-6">
        {d.status === "WAITING_FOR_CLIENT" && d.requiresApproval && current && <ReviewPanel deliverableId={d.id} version={current.version} />}
        {d.status === "APPROVED" && <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success"><CheckCircle2 className="size-4" />Approved — thank you!</div>}
        {d.status === "CHANGES_REQUESTED" && <div className="rounded-2xl border border-line px-4 py-3 text-sm text-muted">Your change request was sent. You&apos;ll be notified when a new version is ready.</div>}
        {d.approvals.length > 0 && (
          <section>
            <h3 className="eyebrow mb-3">History</h3>
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {d.approvals.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center gap-1.5">{a.decision === "APPROVED" ? <CheckCircle2 className="size-3.5 text-success" /> : <MessageSquareWarning className="size-3.5 text-danger" />}<span>V{a.version} — {a.decision === "APPROVED" ? "Approved" : "Changes requested"}</span></div>
                  <div className="text-xs text-subtle">{a.userName} · {fmtDateTime(a.createdAt)}</div>
                  {a.comment && <p className="mt-1 text-muted">“{a.comment}”</p>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </aside>
    </div>
  );
}
