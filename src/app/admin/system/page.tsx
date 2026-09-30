import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Section, Table, th, td } from "@/components/ui/primitives";
import { integrations, env } from "@/lib/env";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("System");

export default async function AdminSystem() {
  const { t, fmt } = await getI18n();
  await requireSuperAdmin();
  const [events, pendingFiles] = await Promise.all([
    db.webhookEvent.findMany({ orderBy: { processedAt: "desc" }, take: 30 }),
    db.file.count({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 86400_000) } } }),
  ]);
  const cfg = [
    ["APP_URL", env.appUrl],
    ["Email provider", integrations.email() ? t("Resend") : t("Not configured")],
    ["Stripe", integrations.stripe() ? t("Configured") : t("Not configured")],
    ["Stripe platform webhook", env.stripe.platformWebhookSecret ? t("Configured") : t("Missing")],
    ["Stripe Connect webhook", env.stripe.connectWebhookSecret ? t("Configured") : t("Missing")],
    ["File storage", integrations.storage() ? `S3 bucket “${env.s3.bucket}”` : t("Not configured")],
    ["Google Drive", integrations.googleDrive() ? t("Configured") : t("Not configured")],
    ["Cron secret", env.cronSecret ? t("Configured") : t("Missing")],
    ["Encryption key", env.encryptionKey ? t("Configured") : t("Missing")],
  ];
  return (
    <>
      <PageHeader title="System" />
      <Section title="Configuration">
        <ul className="panel divide-y divide-line rounded-2xl text-sm">{cfg.map(([k, v]) => <li key={k} className="flex justify-between gap-3 px-4 py-2.5"><span>{t(k)}</span><span className="truncate text-muted">{v}</span></li>)}</ul>
        {pendingFiles > 0 && <p className="mt-3 text-xs text-warning">{pendingFiles} <Tr>stale pending uploads will be cleaned by the daily job.</Tr></p>}
      </Section>
      <Section title="Recent webhook events" className="mt-10">
        <Table>
          <thead><tr><th className={th}><Tr>Processed</Tr></th><th className={th}><Tr>Provider</Tr></th><th className={th}><Tr>Type</Tr></th><th className={th}><Tr>Event ID</Tr></th></tr></thead>
          <tbody>{events.map((e) => <tr key={e.id}><td className={`${td} text-muted`}>{fmt.dateTime(e.processedAt)}</td><td className={td}>{e.provider}</td><td className={td}>{e.type}</td><td className={`${td} font-mono text-xs text-subtle`}>{e.id}</td></tr>)}</tbody>
        </Table>
      </Section>
    </>
  );
}
