import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge, Table, th, td } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/tabs";
import { inputClass } from "@/components/ui/form";
import { fmtDate, relativeTime } from "@/lib/format";

export const metadata = { title: "Users" };
const PER = 50;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {};
  if (sp.q) where.OR = [{ email: { contains: sp.q, mode: "insensitive" } }, { name: { contains: sp.q, mode: "insensitive" } }];
  const f = sp.f ?? "";
  if (f === "active") where.status = "ACTIVE";
  if (f === "suspended") where.status = "SUSPENDED";
  if (f === "verified") where.emailVerifiedAt = { not: null };
  if (f === "unverified") where.emailVerifiedAt = null;
  if (f === "trial") where.memberships = { some: { role: "OWNER", workspace: { subscription: { status: "TRIALING" } } } };
  if (f === "paying") where.memberships = { some: { role: "OWNER", workspace: { subscription: { status: "ACTIVE", stripeSubscriptionId: { not: null } } } } };
  if (f === "cancelled") where.memberships = { some: { role: "OWNER", workspace: { subscription: { status: "CANCELED" } } } };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { memberships: { where: { role: "OWNER" }, include: { workspace: { include: { subscription: { include: { plan: { select: { name: true } } } } } } } }, _count: { select: { clientAccess: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Users" description={`${total} users`} />
      <form className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search name or email…" aria-label="Search users" className={`${inputClass} w-64`} />
        <select name="f" defaultValue={f} aria-label="Filter" className={`${inputClass} w-auto`}>
          <option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="verified">Verified</option><option value="unverified">Unverified</option><option value="trial">Trial</option><option value="paying">Paying</option><option value="cancelled">Cancelled</option>
        </select>
        <button className="h-9 rounded-[10px] border border-line px-3 text-sm text-muted hover:text-fg">Apply</button>
      </form>
      <Table>
        <thead><tr><th className={th}>User</th><th className={th}>Workspace</th><th className={th}>Plan</th><th className={th}>Created</th><th className={th}>Last activity</th><th className={th}>Status</th></tr></thead>
        <tbody>
          {users.map((u) => {
            const w = u.memberships[0]?.workspace;
            return (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className={td}><Link href={`/admin/users/${u.id}`} className="hover:underline"><div>{u.name}</div><div className="text-xs text-muted">{u.email}</div></Link></td>
                <td className={`${td} text-muted`}>{w?.name ?? (u._count.clientAccess ? "Client portal user" : "—")}</td>
                <td className={td}>{w?.subscription ? <span className="text-xs">{w.subscription.plan.name} · <span className="text-muted">{w.subscription.status.toLowerCase()}</span></span> : "—"}</td>
                <td className={`${td} text-muted`}>{fmtDate(u.createdAt)}</td>
                <td className={`${td} text-muted`}>{u.lastActiveAt ? relativeTime(u.lastActiveAt) : "—"}</td>
                <td className={td}><div className="flex gap-1">{u.status === "SUSPENDED" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}{!u.emailVerifiedAt && <Badge tone="warning">Unverified</Badge>}{u.platformRole === "SUPER_ADMIN" && <Badge tone="accent">Admin</Badge>}</div></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(f ? { f } : {}), page: String(p) })}`} />
    </>
  );
}
