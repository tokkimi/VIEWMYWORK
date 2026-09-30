import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Section, Table, th, td } from "@/components/ui/primitives";
import { integrations, env } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "System" };

export default async function AdminSystem() {
  await requireSuperAdmin();
  const [events, pendingFiles] = await Promise.all([
    db.webhookEvent.findMany({ orderBy: { processedAt: "desc" }, take: 30 }),
    db.file.count({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 86400_000) } } }),
  ]);
  const cfg = [
    ["APP_URL", env.appUrl],
    ["Email provider", integrations.email() ? "Resend" : "Not configured"],
    ["Stripe", integrations.stripe() ? "Configured" : "Not configured"],
    ["Stripe platform webhook", env.stripe.platformWebhookSecret ? "Configured" : "Missing"],
    ["Stripe Connect webhook", env.stripe.connectWebhookSecret ? "Configured" : "Missing"],
    ["File storage", integrations.storage() ? `S3 bucket “${env.s3.bucket}”` : "Not configured"],
    ["Google Drive", integrations.googleDrive() ? "Configured" : "Not configured"],
    ["Cron secret", env.cronSecret ? "Configured" : "Missing"],
    ["Encryption key", env.encryptionKey ? "Configured" : "Missing"],
  ];
  return (
    <>
      <PageHeader title="System" />
      <Section title="Configuration">
        <ul className="panel divide-y divide-line rounded-2xl text-sm">{cfg.map(([k, v]) => <li key={k} className="flex justify-between gap-3 px-4 py-2.5"><span>{k}</span><span className="truncate text-muted">{v}</span></li>)}</ul>
        {pendingFiles > 0 && <p className="mt-3 text-xs text-warning">{pendingFiles} stale pending uploads will be cleaned by the daily job.</p>}
      </Section>
      <Section title="Recent webhook events" className="mt-10">
        <Table>
          <thead><tr><th className={th}>Processed</th><th className={th}>Provider</th><th className={th}>Type</th><th className={th}>Event ID</th></tr></thead>
          <tbody>{events.map((e) => <tr key={e.id}><td className={`${td} text-muted`}>{fmtDateTime(e.processedAt)}</td><td className={td}>{e.provider}</td><td className={td}>{e.type}</td><td className={`${td} font-mono text-xs text-subtle`}>{e.id}</td></tr>)}</tbody>
        </Table>
      </Section>
    </>
  );
}
