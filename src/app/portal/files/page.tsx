import { db } from "@/lib/db";
import { requirePortal, portalProjectWhere } from "@/lib/auth/portal";
import { FileGrid } from "@/components/app/files";
import { EmptyState } from "@/components/ui/primitives";
import { toFileDTO } from "@/lib/file-dto";
import { Files } from "lucide-react";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Files");

export default async function PortalFiles() {
  const ctx = await requirePortal();
  const files = await db.file.findMany({
    where: {
      workspaceId: ctx.workspace.id, clientId: ctx.client.id, visibility: "CLIENT_VISIBLE", deletedAt: null, status: "READY",
      AND: [
        { OR: [{ projectId: null }, { project: portalProjectWhere(ctx) }] },
        { OR: [{ deliverableVersionId: null }, { deliverableVersion: { deliverable: { visibility: "CLIENT_VISIBLE" } } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight"><Tr>Files</Tr></h1>
      {files.length === 0 ? <EmptyState icon={<Files />} title="No files yet" description="Documents and deliverables shared with you will appear here." /> : <FileGrid files={files.map(toFileDTO)} showVisibility={false} />}
    </>
  );
}
