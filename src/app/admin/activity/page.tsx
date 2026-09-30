import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Table, th, td, EmptyState } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/tabs";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };
const PER = 100;

export default async function AdminActivity({ searchParams }: { searchParams: Promise<{ page?: string; scope?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.scope === "WORKSPACE" ? { scope: "WORKSPACE" } : sp.scope === "PLATFORM" ? { scope: "PLATFORM" } : {};
  const [total, logs] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER })]);
  return (
    <>
      <PageHeader title="Audit log" description="Sensitive actions across the platform." />
      {logs.length === 0 ? <EmptyState title="No audit entries yet" /> : (
        <Table>
          <thead><tr><th className={th}>When</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Target</th><th className={th}>Scope</th><th className={th}>IP</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className={`${td} whitespace-nowrap text-muted`}>{fmtDateTime(l.createdAt)}</td>
                <td className={td}>{l.actorEmail ?? "system"}</td>
                <td className={td}>{l.action.replace(/_/g, " ").toLowerCase()}</td>
                <td className={`${td} text-xs text-muted`}>{l.targetType} {l.targetId?.slice(0, 8)}</td>
                <td className={`${td} text-xs text-muted`}>{l.scope.toLowerCase()}</td>
                <td className={`${td} text-xs text-subtle`}>{l.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => `/admin/activity?page=${p}${sp.scope ? `&scope=${sp.scope}` : ""}`} />
    </>
  );
}
