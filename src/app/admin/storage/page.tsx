import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Stat, Section } from "@/components/ui/primitives";
import { BarChart } from "@/components/charts";
import { formatBytes } from "@/lib/plans";

export const metadata = { title: "Storage" };

export default async function AdminStorage() {
  await requireSuperAdmin();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [total, largest, files, recent] = await Promise.all([
    db.workspace.aggregate({ _sum: { storageUsedBytes: true } }),
    db.workspace.findMany({ orderBy: { storageUsedBytes: "desc" }, take: 15, select: { id: true, name: true, storageUsedBytes: true, subscription: { select: { plan: { select: { storageLimitMb: true } } } } } }),
    db.file.count({ where: { deletedAt: null, status: "READY", source: "UPLOAD" } }),
    db.file.findMany({ where: { createdAt: { gte: start }, source: "UPLOAD", status: "READY" }, select: { createdAt: true, sizeBytes: true } }),
  ]);
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)));
  const growth = months.map((m) => ({ label: m.toISOString().slice(5, 7), value: recent.filter((f) => f.createdAt.getUTCMonth() === m.getUTCMonth() && f.createdAt.getUTCFullYear() === m.getUTCFullYear()).reduce((a, f) => a + Number(f.sizeBytes), 0) }));
  return (
    <>
      <PageHeader title="Storage" />
      <div className="panel grid grid-cols-2 divide-x divide-line rounded-2xl sm:grid-cols-3"><Stat label="Total storage" value={formatBytes(total._sum.storageUsedBytes ?? 0n)} /><Stat label="Uploaded files" value={files} /><Stat label="Drive links" value="Not counted" /></div>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <Section title="Storage growth" description="New uploads per month"><div className="panel rounded-2xl p-5"><BarChart data={growth} format={(v) => formatBytes(v)} /></div></Section>
        <Section title="Largest workspaces">
          <ul className="panel divide-y divide-line rounded-2xl text-sm">{largest.map((w) => <li key={w.id} className="flex justify-between gap-3 px-4 py-2.5"><Link href={`/admin/workspaces/${w.id}`} className="truncate hover:underline">{w.name}</Link><span className="num shrink-0 text-muted">{formatBytes(w.storageUsedBytes)}{w.subscription?.plan.storageLimitMb ? ` / ${formatBytes(BigInt(w.subscription.plan.storageLimitMb) * 1048576n)}` : ""}</span></li>)}</ul>
        </Section>
      </div>
    </>
  );
}
