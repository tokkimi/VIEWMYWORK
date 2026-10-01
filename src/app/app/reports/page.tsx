import Link from "next/link";
import { Eye, FileBarChart } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, can, projectScope } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { PageHeader, Section, Badge, EmptyState } from "@/components/ui/primitives";
import { UpgradeCard } from "@/components/app/upgrade-card";
import { SendReportDialog, ProjectReportToggle, ReportSettingsForm, DigestNowButton } from "@/components/app/reports";
import { DEFAULT_REPORTS, WEEKDAYS, type ReportData } from "@/lib/reports";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Weekly reports");

export default async function Reports() {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  if (!(await hasFeature(ctx.workspace.id, "weekly_reports")))
    return (
      <>
        <PageHeader title="Weekly reports" />
        <UpgradeCard title="Automatic weekly reports" description="Keep clients informed without writing a single email, and get your portfolio digest every week." points={["A weekly report per project: done, in progress, next steps, waiting for the client", "Sent by email and readable in the client portal", "Your own words at the top when you send it manually", "A portfolio digest for you and your admins"]} />
      </>
    );
  const canSettings = can(ctx, "settings", "manage");
  const [settings, projects, history] = await Promise.all([
    db.workspaceSetting.findUnique({ where: { workspaceId: ctx.workspace.id }, select: { clientReports: true, reportWeekday: true, teamDigest: true, lastTeamDigestAt: true } }),
    db.project.findMany({
      where: { ...projectScope(ctx), archivedAt: null, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, portalEnabled: true, weeklyReport: true, client: { select: { id: true, company: true, firstName: true, lastName: true, email: true, portalAccess: { where: { revokedAt: null }, select: { id: true }, take: 1 } } }, reports: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    }),
    db.projectReport.findMany({ where: { project: projectScope(ctx) }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, createdAt: true, auto: true, recipients: true, data: true, project: { select: { name: true } } } }),
  ]);
  const rules = settings ? { clientReports: settings.clientReports, weekday: settings.reportWeekday, teamDigest: settings.teamDigest } : DEFAULT_REPORTS;
  const clientName = (c: (typeof projects)[number]["client"]) => c.company || `${c.firstName} ${c.lastName}`.trim();

  return (
    <>
      <PageHeader title="Weekly reports" description="Clients get a clear weekly summary of their project, and you get your portfolio digest — automatically." actions={canSettings && rules.teamDigest ? <DigestNowButton /> : undefined} />
      <div className="space-y-10">
        <Section title="Projects" description={rules.clientReports ? t("Automatic reports go out every {day}.", { day: t(WEEKDAYS[rules.weekday]!) }) : t("Automatic client reports are off: you can still send them manually.")}>
          {projects.length === 0 ? <EmptyState icon={<FileBarChart className="size-5" />} title="No active project" /> : (
            <ul className="panel divide-y divide-line rounded-2xl">
              {projects.map((p) => {
                const reachable = p.portalEnabled && (p.client.portalAccess.length > 0 || Boolean(p.client.email));
                return (
                  <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/projects/${p.id}`} className="truncate text-sm font-medium hover:underline">{p.name}</Link>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-subtle">
                        <span>{clientName(p.client)}</span>
                        <span>{p.reports[0] ? t("Last report {date}", { date: fmt.date(p.reports[0].createdAt) }) : t("No report sent yet")}</span>
                        {!reachable && <Badge tone="neutral">{p.portalEnabled ? t("No portal access") : t("Portal disabled")}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <label className="flex items-center gap-2 text-xs text-muted"><ProjectReportToggle projectId={p.id} enabled={p.weeklyReport} disabled={!reachable} /><Tr>Automatic</Tr></label>
                      <Link href={`/app/reports/preview/${p.id}`} className="inline-flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[13px] text-muted hover:bg-white/[0.05] hover:text-fg"><Eye className="size-3.5" /><Tr>Preview</Tr></Link>
                      {reachable && <SendReportDialog projectId={p.id} projectName={p.name} clientName={clientName(p.client)} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Settings">
          <div className="panel rounded-2xl p-5">
            <ReportSettingsForm settings={rules} canEdit={canSettings} />
            {settings?.lastTeamDigestAt && <p className="mt-3 text-xs text-subtle">{t("Last digest sent {date}", { date: fmt.dateTime(settings.lastTeamDigestAt) })}</p>}
          </div>
        </Section>

        <Section title="Sent reports">
          {history.length === 0 ? <p className="text-sm text-subtle"><Tr>No report sent yet</Tr></p> : (
            <ul className="panel divide-y divide-line rounded-2xl">
              {history.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/reports/${r.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]">
                    <FileBarChart className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate">{r.project.name} <span className="text-subtle">· {fmt.dateTime(r.createdAt)}</span></span>
                    <Badge tone={r.auto ? "neutral" : "accent"}>{r.auto ? t("Automatic") : t("Manual")}</Badge>
                    <span className="num hidden text-xs text-muted sm:inline">{(r.data as unknown as ReportData).project.progress}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
