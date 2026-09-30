import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Table, th, td, EmptyState } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Audit log");
const PER = 100;

export default async function AdminActivity({ searchParams }: { searchParams: Promise<{ page?: string; scope?: string }> }) {
  const { t, fmt } = await getI18n();
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
          <thead><tr><th className={th}><Tr>When</Tr></th><th className={th}><Tr>Actor</Tr></th><th className={th}><Tr>Action</Tr></th><th className={th}><Tr>Target</Tr></th><th className={th}><Tr>Scope</Tr></th><th className={th}><Tr>IP</Tr></th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className={`${td} whitespace-nowrap text-muted`}>{fmt.dateTime(l.createdAt)}</td>
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
