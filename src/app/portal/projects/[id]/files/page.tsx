import { uploadLimitMb } from "@/lib/storage";
import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { FileGrid } from "@/components/app/files";
import { PortalUploader } from "@/components/portal/portal-uploader";
import { EmptyState } from "@/components/ui/primitives";
import { toFileDTO } from "@/lib/file-dto";
import { integrations } from "@/lib/env";
import { Tr } from "@/lib/i18n/client";

export default async function PortalProjectFiles({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePortal();
  await getPortalProject(ctx, id);
  const [files, requests] = await Promise.all([
    db.file.findMany({ where: { projectId: id, visibility: "CLIENT_VISIBLE", deletedAt: null, status: "READY", OR: [{ deliverableVersionId: null }, { deliverableVersion: { deliverable: { visibility: "CLIENT_VISIBLE" } } }] }, orderBy: { createdAt: "desc" } }),
    db.clientWait.findMany({ where: { projectId: id, reason: "DOCUMENT", resolvedAt: null, entityType: null } }),
  ]);
  return (
    <div className="space-y-6">
      {requests.length > 0 && <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 text-sm"><div className="font-medium"><Tr>Requested from you</Tr></div><ul className="mt-1 list-inside list-disc text-muted">{requests.map((r) => <li key={r.id}>{r.label}</li>)}</ul></div>}
      <PortalUploader projectId={id} configured={integrations.storage()} maxMb={uploadLimitMb()} />
      {files.length === 0 ? <EmptyState title="No files yet" description="Documents shared with you and files you upload appear here." /> : <FileGrid files={files.map(toFileDTO)} showVisibility={false} />}
    </div>
  );
}
