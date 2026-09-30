import { FolderOpen } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, projectScope, can } from "@/lib/auth/context";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { FileGrid } from "@/components/app/files";
import { Uploader } from "@/components/app/uploader";
import { toFileDTO } from "@/lib/file-dto";
import { integrations } from "@/lib/env";
import { storageQuota, formatBytes } from "@/lib/plans";
import { inputClass } from "@/components/ui/form";

export const metadata = { title: "Files" };

export default async function Files({ searchParams }: { searchParams: Promise<{ project?: string; q?: string }> }) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const scope = projectScope(ctx);
  const [files, projects, quota] = await Promise.all([
    db.file.findMany({
      where: {
        workspaceId: ctx.workspace.id, deletedAt: null, status: "READY",
        ...(sp.project ? { projectId: sp.project, project: scope } : { OR: [{ projectId: null, ...(can(ctx, "clients", "view") ? {} : { clientId: null }) }, { project: scope }] }),
        ...(can(ctx, "invoices", "view") ? {} : { invoiceId: null }),
        ...(can(ctx, "finance", "view") ? {} : { expenseId: null }),
        ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.project.findMany({ where: { ...scope, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    storageQuota(ctx.workspace.id),
  ]);
  const pct = quota.limit ? Number((quota.used * 1000n) / quota.limit) / 10 : 0;
  return (
    <>
      <PageHeader
        title="Files"
        description={quota.limit ? `${formatBytes(quota.used)} of ${formatBytes(quota.limit)} used` : `${formatBytes(quota.used)} used`}
        actions={quota.limit ? <div className="w-40"><ProgressBar value={pct} size="sm" label="Storage used" /></div> : undefined}
      />
      <div className="space-y-6">
        {can(ctx, "files", "upload") && <Uploader target={sp.project ? { projectId: sp.project } : {}} configured={integrations.storage()} />}
        <form className="flex flex-wrap gap-2" aria-label="Filter">
          <input name="q" defaultValue={sp.q} placeholder="Search files…" aria-label="Search files" className={`${inputClass} w-56`} />
          <select name="project" defaultValue={sp.project ?? ""} aria-label="Project" className={`${inputClass} w-auto`}><option value="">All files</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button className="h-9 rounded-[10px] border border-line px-3 text-sm text-muted hover:text-fg">Apply</button>
        </form>
        {files.length === 0 ? <EmptyState icon={<FolderOpen />} title="No files yet" description="Upload documents, images and deliverables — or link them from Google Drive." /> : <FileGrid files={files.map(toFileDTO)} canManage={can(ctx, "files", "upload")} />}
      </div>
    </>
  );
}
