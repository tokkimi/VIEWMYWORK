import { db } from "@/lib/db";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { storageQuota, formatBytes } from "@/lib/plans";
import { ProgressBar } from "@/components/ui/primitives";
import { integrations } from "@/lib/env";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Storage");

export default async function Storage() {
  const { t } = await getI18n();
  const ctx = await requireWorkspace();
  requirePerm(ctx, "settings", "manage");
  const [q, byProject, largest] = await Promise.all([
    storageQuota(ctx.workspace.id),
    db.file.groupBy({ by: ["projectId"], where: { workspaceId: ctx.workspace.id, deletedAt: null, status: "READY", source: "UPLOAD" }, _sum: { sizeBytes: true }, orderBy: { _sum: { sizeBytes: "desc" } }, take: 8 }),
    db.file.findMany({ where: { workspaceId: ctx.workspace.id, deletedAt: null, status: "READY", source: "UPLOAD" }, orderBy: { sizeBytes: "desc" }, take: 8, include: { project: { select: { name: true } } } }),
  ]);
  const names = new Map((await db.project.findMany({ where: { id: { in: byProject.map((b) => b.projectId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const pct = q.limit ? Number((q.used * 1000n) / q.limit) / 10 : 0;
  return (
    <div className="space-y-8">
      {!integrations.storage() && <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"><Tr>File storage isn&apos;t configured on this platform, so uploads are disabled.</Tr></p>}
      <div className="panel rounded-2xl p-5">
        <div className="flex items-end justify-between"><span className="num text-2xl font-semibold">{formatBytes(q.used)}</span><span className="text-sm text-muted"><Tr>of</Tr> {q.limit === null ? "unlimited" : formatBytes(q.limit)}</span></div>
        {q.limit !== null && <ProgressBar value={pct} className="mt-3" label="Storage used" />}
        <p className="mt-3 text-xs text-subtle"><Tr>Google Drive links don&apos;t count toward storage. Deleting files frees space immediately.</Tr></p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[13px] font-semibold"><Tr>By project</Tr></h2>
          <ul className="panel divide-y divide-line rounded-2xl text-sm">{byProject.length === 0 ? <li className="px-4 py-4 text-subtle"><Tr>No files.</Tr></li> : byProject.map((b) => <li key={b.projectId ?? "none"} className="flex justify-between px-4 py-2.5"><span className="truncate">{b.projectId ? names.get(b.projectId) ?? t("Project") : t("Workspace files")}</span><span className="num text-muted">{formatBytes(b._sum.sizeBytes ?? 0n)}</span></li>)}</ul>
        </section>
        <section>
          <h2 className="mb-3 text-[13px] font-semibold"><Tr>Largest files</Tr></h2>
          <ul className="panel divide-y divide-line rounded-2xl text-sm">{largest.length === 0 ? <li className="px-4 py-4 text-subtle"><Tr>No files.</Tr></li> : largest.map((f) => <li key={f.id} className="flex justify-between gap-3 px-4 py-2.5"><span className="min-w-0 truncate">{f.name}<span className="text-subtle"> · {f.project?.name ?? "—"}</span></span><span className="num shrink-0 text-muted">{formatBytes(f.sizeBytes)}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
