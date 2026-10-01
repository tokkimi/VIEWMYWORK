import Link from "next/link";
import { ChevronRight, FileBarChart } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { EmptyState } from "@/components/ui/primitives";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import type { ReportData } from "@/lib/reports";

export default async function PortalReports({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  const { id } = await params;
  const ctx = await requirePortal();
  await getPortalProject(ctx, id);
  const reports = await db.projectReport.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 52, select: { id: true, createdAt: true, data: true } });
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold"><Tr>Weekly reports</Tr></h2>
      {reports.length === 0 ? <EmptyState icon={<FileBarChart className="size-5" />} title="No report yet" description="Your weekly progress reports will appear here." /> : (
        <ul className="panel divide-y divide-line rounded-2xl">
          {reports.map((r) => {
            const d = r.data as unknown as ReportData;
            return (
              <li key={r.id}>
                <Link href={`/portal/projects/${id}/reports/${r.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]">
                  <FileBarChart className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{t("Report of {date}", { date: fmt.date(r.createdAt) })}</span>
                  <span className="num text-xs text-muted">{d.project.progress}%</span>
                  <ChevronRight className="size-4 text-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
