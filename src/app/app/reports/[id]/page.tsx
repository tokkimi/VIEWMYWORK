import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, projectScope, isUuid } from "@/lib/auth/context";
import { ReportView } from "@/components/report-view";
import { PageHeader } from "@/components/ui/primitives";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";
import type { ReportData } from "@/lib/reports";

export const generateMetadata = pageTitle("Weekly report");

export default async function SentReport({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const { id } = await params;
  const ctx = await requireWorkspace();
  if (!isUuid(id)) notFound();
  const r = await db.projectReport.findFirst({ where: { id, project: projectScope(ctx) }, include: { project: { select: { name: true } } } });
  if (!r) notFound();
  return (
    <>
      <Link href="/app/reports" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ChevronLeft className="size-3.5" /><Tr>Weekly reports</Tr></Link>
      <PageHeader title={r.project.name} eyebrow={r.auto ? t("Automatic report") : t("Manual report")} description={t("Sent to {n} recipient(s)", { n: r.recipients })} />
      <div className="max-w-3xl"><ReportView data={r.data as unknown as ReportData} note={r.note} sentAt={r.createdAt} /></div>
    </>
  );
}
