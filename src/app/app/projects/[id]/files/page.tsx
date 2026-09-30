import { uploadLimitMb } from "@/lib/storage";
import { FolderOpen } from "lucide-react";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { EmptyState } from "@/components/ui/primitives";
import { FileGrid } from "@/components/app/files";
import { Uploader } from "@/components/app/uploader";
import { DriveLinkDialog } from "@/components/app/drive-link";
import { toFileDTO } from "@/lib/file-dto";
import { integrations } from "@/lib/env";

export default async function ProjectFiles({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, perms } = await loadProject(id);
  const [files, drive] = await Promise.all([
    db.file.findMany({ where: { projectId: id, deletedAt: null, status: "READY" }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.integration.findUnique({ where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider: "GOOGLE_DRIVE" } } }),
  ]);
  const canUpload = hasLevel(perms, "files", "upload");
  return (
    <div className="space-y-6">
      {canUpload && (
        <div className="space-y-2">
          <Uploader target={{ projectId: id }} configured={integrations.storage()} maxMb={uploadLimitMb()} />
          {drive?.status === "CONNECTED" && <DriveLinkDialog projectId={id} />}
        </div>
      )}
      {files.length === 0 ? <EmptyState icon={<FolderOpen />} title="No files yet" description="Upload briefs, contracts, assets and exports. Mark them visible to share with your client." /> : <FileGrid files={files.map(toFileDTO)} canManage={canUpload} />}
    </div>
  );
}
