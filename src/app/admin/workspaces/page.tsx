import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge, Table, th, td } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { inputClass } from "@/components/ui/form";
import { formatBytes } from "@/lib/plans";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Workspaces");
const PER = 50;

export default async function AdminWorkspaces({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { t, fmt } = await getI18n();
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {};
  const [total, list] = await Promise.all([
    db.workspace.count({ where }),
    db.workspace.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { members: { where: { role: "OWNER" }, include: { user: { select: { email: true } } } }, subscription: { include: { plan: { select: { name: true } } } }, _count: { select: { members: true, clients: true, projects: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Workspaces" description={t("{n} workspaces", { n: total })} />
      <form className="mb-5"><input name="q" defaultValue={sp.q} placeholder={t("Search workspaces…")} aria-label={t("Search")} className={`${inputClass} w-64`} /></form>
      <Table>
        <thead><tr><th className={th}><Tr>Workspace</Tr></th><th className={th}><Tr>Owner</Tr></th><th className={th}><Tr>Members</Tr></th><th className={th}><Tr>Clients</Tr></th><th className={th}><Tr>Projects</Tr></th><th className={th}><Tr>Storage</Tr></th><th className={th}><Tr>Plan</Tr></th><th className={th}><Tr>Created</Tr></th></tr></thead>
        <tbody>
          {list.map((w) => (
            <tr key={w.id} className="hover:bg-white/[0.02]">
              <td className={td}><Link href={`/admin/workspaces/${w.id}`} className="hover:underline">{w.name}</Link></td>
              <td className={`${td} text-muted`}>{w.members[0]?.user.email ?? "—"}</td>
              <td className={`${td} num`}>{w._count.members}</td>
              <td className={`${td} num`}>{w._count.clients}</td>
              <td className={`${td} num`}>{w._count.projects}</td>
              <td className={`${td} num text-muted`}>{formatBytes(w.storageUsedBytes)}</td>
              <td className={td}>{w.subscription ? <span className="flex items-center gap-1.5 text-xs">{w.subscription.plan.name}<Badge tone={w.subscription.status === "ACTIVE" ? "success" : w.subscription.status === "TRIALING" ? "accent" : "warning"}>{w.subscription.status.toLowerCase()}</Badge></span> : "—"}</td>
              <td className={`${td} text-muted`}>{fmt.date(w.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => `/admin/workspaces?page=${p}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} />
    </>
  );
}
