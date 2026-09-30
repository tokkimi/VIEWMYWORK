import { uploadLimitMb } from "@/lib/storage";
import { FolderOpen } from "lucide-react";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { EmptyState } from "@/components/ui/primitives";
import { FileGrid, DeletedFiles } from "@/components/app/files";

const RECENT = () => new Date(Date.now() - 30 * 86400_000);
import { Uploader } from "@/components/app/uploader";
import { DriveLinkDialog } from "@/components/app/drive-link";
import { toFileDTO } from "@/lib/file-dto";
import { integrations } from "@/lib/env";

export default async function ProjectFiles({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, project, perms } = await loadProject(id);
  const [files, drive, deleted] = await Promise.all([
    // The project's files, plus documents attached to its client (e.g. uploaded from the client profile).
    db.file.findMany({ where: { deletedAt: null, status: "READY", OR: [{ projectId: id }, { projectId: null, clientId: project.clientId, invoiceId: null, expenseId: null, taskId: null }] }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.integration.findUnique({ where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider: "GOOGLE_DRIVE" } } }),
    db.file.findMany({ where: { deletedAt: { gte: RECENT() }, storageKey: { not: null }, OR: [{ projectId: id }, { projectId: null, clientId: project.clientId, invoiceId: null, expenseId: null, taskId: null }] }, orderBy: { deletedAt: "desc" }, take: 50, select: { id: true, name: true, deletedAt: true } }),
  ]);
  const canUpload = hasLevel(perms, "files", "upload");
  return (
    <div className="space-y-6">
      {canUpload && (
        <div className="space-y-2">
          <Uploader target={{ projectId: id }} configured={integrations.storage()} maxMb={uploadLimitMb()} defaultVisibility="CLIENT_VISIBLE" />
          {drive?.status === "CONNECTED" && <DriveLinkDialog projectId={id} />}
        </div>
      )}
      {files.length === 0 ? <EmptyState icon={<FolderOpen />} title="No files yet" description="Upload briefs, contracts, assets and exports. Mark them visible to share with your client." /> : <FileGrid files={files.map(toFileDTO)} canManage={canUpload} />}
      {canUpload && <DeletedFiles files={deleted.map((f) => ({ id: f.id, name: f.name, deletedAt: f.deletedAt!.toISOString() }))} />}
    </div>
  );
}
