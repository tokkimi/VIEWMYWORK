import Link from "next/link";
import { ChevronLeft, Eye } from "lucide-react";
import { requireWorkspace, requireProjectPerm } from "@/lib/auth/context";
import { requireFeature } from "@/lib/plans";
import { buildProjectReport } from "@/server/queries/reports";
import { ReportView } from "@/components/report-view";
import { SendReportDialog } from "@/components/app/reports";
import { PageHeader } from "@/components/ui/primitives";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";
import { db } from "@/lib/db";

export const generateMetadata = pageTitle("Report preview");

export default async function ReportPreview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await requireWorkspace();
  const { project } = await requireProjectPerm(ctx, projectId, "projects", "view");
  await requireFeature(ctx.workspace.id, "weekly_reports");
  const client = await db.client.findUniqueOrThrow({ where: { id: project.clientId }, select: { company: true, firstName: true, lastName: true } });
  const data = await buildProjectReport(project.id);
  return (
    <>
      <Link href="/app/reports" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ChevronLeft className="size-3.5" /><Tr>Weekly reports</Tr></Link>
      <PageHeader title={project.name} eyebrow="Report preview" actions={project.portalEnabled ? <SendReportDialog projectId={project.id} projectName={project.name} clientName={client.company || `${client.firstName} ${client.lastName}`.trim()} /> : undefined} />
      <p className="mb-6 flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-muted"><Eye className="size-3.5" /><Tr>This is exactly what your client will see. Only client-visible items are included.</Tr></p>
      <div className="max-w-3xl"><ReportView data={data} /></div>
    </>
  );
}
