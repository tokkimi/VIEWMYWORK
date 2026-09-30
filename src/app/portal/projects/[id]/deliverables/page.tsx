import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { DeliverableStatusBadge } from "@/components/status";
import { EmptyState } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export default async function PortalDeliverables({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  const { id } = await params;
  const ctx = await requirePortal();
  await getPortalProject(ctx, id);
  const list = await db.deliverable.findMany({ where: { projectId: id, visibility: "CLIENT_VISIBLE", status: { not: "DRAFT" } }, orderBy: { updatedAt: "desc" } });
  if (!list.length) return <EmptyState icon={<Package />} title="No deliverables yet" description="Designs, builds and documents to review will appear here." />;
  return (
    <ul className="panel divide-y divide-line rounded-2xl">
      {list.map((d) => (
        <li key={d.id}>
          <Link href={`/portal/projects/${id}/deliverables/${d.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{d.title} <span className="text-subtle">V{d.currentVersion}</span></div><div className="text-xs text-subtle"><Tr>Updated</Tr> {fmt.date(d.updatedAt)}</div></div>
            <DeliverableStatusBadge s={d.status} />
            <ChevronRight className="size-4 text-subtle" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
