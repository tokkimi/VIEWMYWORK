import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Table, th, td, Badge, EmptyState } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/form";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Support" };

/** Email delivery log lookup — useful for invoice disputes (“I never received it”). */
export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const logs = sp.email ? await db.emailLog.findMany({ where: { recipient: { contains: sp.email.trim().toLowerCase(), mode: "insensitive" } }, orderBy: { createdAt: "desc" }, take: 100, include: { workspace: { select: { name: true } } } }) : [];
  return (
    <>
      <PageHeader title="Support" description="Look up transactional email delivery for a recipient." />
      <form className="mb-6 flex gap-2"><input name="email" type="search" defaultValue={sp.email} placeholder="recipient@example.com" aria-label="Recipient email" className={`${inputClass} w-72`} /><button className="h-9 rounded-[10px] border border-line px-3 text-sm text-muted">Search</button></form>
      {sp.email && (logs.length === 0 ? <EmptyState title="No emails found for this recipient" /> : (
        <Table>
          <thead><tr><th className={th}>When</th><th className={th}>Recipient</th><th className={th}>Template</th><th className={th}>Workspace</th><th className={th}>Status</th><th className={th}>Provider ID</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className={`${td} whitespace-nowrap text-muted`}>{fmtDateTime(l.createdAt)}</td>
                <td className={td}>{l.recipient}</td>
                <td className={`${td} text-muted`}>{l.template.replace(/_/g, " ")}</td>
                <td className={`${td} text-muted`}>{l.workspace?.name ?? "Platform"}</td>
                <td className={td}><Badge tone={l.status === "SENT" ? "success" : l.status === "FAILED" ? "danger" : "warning"}>{l.status.toLowerCase().replace("_", " ")}</Badge>{l.failureReason && <div className="mt-1 text-xs text-danger">{l.failureReason}</div>}</td>
                <td className={`${td} font-mono text-xs text-subtle`}>{l.providerMessageId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ))}
    </>
  );
}
