import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { isUuid } from "@/lib/auth/context";
import { ReportView } from "@/components/report-view";
import { Tr } from "@/lib/i18n/client";
import type { ReportData } from "@/lib/reports";

export default async function PortalReport({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const ctx = await requirePortal();
  await getPortalProject(ctx, id);
  if (!isUuid(rid)) notFound();
  const r = await db.projectReport.findFirst({ where: { id: rid, projectId: id } });
  if (!r) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/portal/projects/${id}/reports`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ChevronLeft className="size-3.5" /><Tr>All reports</Tr></Link>
      <ReportView data={r.data as unknown as ReportData} note={r.note} sentAt={r.createdAt} />
    </div>
  );
}
