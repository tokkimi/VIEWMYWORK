import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Stat, Section } from "@/components/ui/primitives";
import { platformRevenue } from "@/server/queries/admin";
import { formatBytes } from "@/lib/plans";
import { integrations } from "@/lib/env";
import { pageTitle, getI18n } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Overview");

export default async function AdminOverview() {
  const { t, fmt } = await getI18n();
  await requireSuperAdmin();
  const d30 = new Date(Date.now() - 30 * 86400_000);
  const [users, activeUsers, workspaces, trials, projects, storage, rev, emailsFailed] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastActiveAt: { gte: d30 } } }),
    db.workspace.count({ where: { archivedAt: null } }),
    db.subscription.count({ where: { status: "TRIALING", trialEndsAt: { gt: new Date() } } }),
    db.project.count({ where: { archivedAt: null } }),
    db.workspace.aggregate({ _sum: { storageUsedBytes: true } }),
    platformRevenue(),
    db.emailLog.count({ where: { status: "FAILED", createdAt: { gte: d30 } } }),
  ]);
  const cfg = [[t("Email (Resend)"), integrations.email()], ["Stripe", integrations.stripe()], [t("File storage"), integrations.storage()], ["Google Drive", integrations.googleDrive()]] as const;
  return (
    <>
      <PageHeader title="Platform overview" description="Platform subscription metrics only — professionals' client revenue is never included." />
      <div className="panel grid grid-cols-2 divide-line overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-b [&>*]:border-r [&>*]:border-line">
        <Stat label="Total users" value={users} />
        <Stat label="Active users" value={activeUsers} hint="last 30 days" />
        <Stat label="Workspaces" value={workspaces} />
        <Stat label="Paying workspaces" value={rev.paying} />
        <Stat label="Trials" value={trials} />
        <Stat label="MRR" value={fmt.money(rev.mrr, "EUR")} tone="accent" />
        <Stat label="ARR" value={fmt.money(rev.arr, "EUR")} />
        <Stat label="New subscriptions" value={rev.newCount} hint="30 days" />
        <Stat label="Cancellations" value={rev.cancellations} hint="30 days" />
        <Stat label="Projects" value={projects} />
        <Stat label="Storage" value={formatBytes(storage._sum.storageUsedBytes ?? 0n)} />
        <Stat label="Failed emails" value={emailsFailed} hint="30 days" tone={emailsFailed ? "warning" : undefined} />
      </div>
      <Section title="Configuration" className="mt-10">
        <ul className="panel divide-y divide-line rounded-2xl text-sm">
          {cfg.map(([k, ok]) => <li key={k} className="flex justify-between px-4 py-2.5"><span>{k}</span><span className={ok ? "text-success" : "text-warning"}>{ok ? t("Configured") : t("Not configured")}</span></li>)}
        </ul>
      </Section>
    </>
  );
}
