import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/context";
import { PageHeader, Badge, Table, th, td } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { inputClass } from "@/components/ui/form";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Users");
const PER = 50;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  const { t, fmt } = await getI18n();
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
      <PageHeader title="Users" description={t("{n} users", { n: total })} />
      <form className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder={t("Search name or email…")} aria-label={t("Search users")} className={`${inputClass} w-64`} />
        <select name="f" defaultValue={f} aria-label={t("Filter")} className={`${inputClass} w-auto`}>
          <option value="">{t("All")}</option><option value="active">{t("Active")}</option><option value="suspended">{t("Suspended")}</option><option value="verified">{t("Verified")}</option><option value="unverified">{t("Unverified")}</option><option value="trial">{t("Trial")}</option><option value="paying">{t("Paying")}</option><option value="cancelled">{t("Cancelled")}</option>
        </select>
        <button className="h-9 rounded-[10px] border border-line px-3 text-sm text-muted hover:text-fg"><Tr>Apply</Tr></button>
      </form>
      <Table>
        <thead><tr><th className={th}><Tr>User</Tr></th><th className={th}><Tr>Workspace</Tr></th><th className={th}><Tr>Plan</Tr></th><th className={th}><Tr>Created</Tr></th><th className={th}><Tr>Last activity</Tr></th><th className={th}><Tr>Status</Tr></th></tr></thead>
        <tbody>
          {users.map((u) => {
            const w = u.memberships[0]?.workspace;
            return (
              <tr key={u.id} className="hover:bg-white/[0.02]">
                <td className={td}><Link href={`/admin/users/${u.id}`} className="hover:underline"><div>{u.name}</div><div className="text-xs text-muted">{u.email}</div></Link></td>
                <td className={`${td} text-muted`}>{w?.name ?? (u._count.clientAccess ? t("Client portal user") : "—")}</td>
                <td className={td}>{w?.subscription ? <span className="text-xs">{w.subscription.plan.name} · <span className="text-muted">{w.subscription.status.toLowerCase()}</span></span> : "—"}</td>
                <td className={`${td} text-muted`}>{fmt.date(u.createdAt)}</td>
                <td className={`${td} text-muted`}>{u.lastActiveAt ? fmt.rel(u.lastActiveAt) : "—"}</td>
                <td className={td}><div className="flex gap-1">{u.status === "SUSPENDED" ? <Badge tone="danger"><Tr>Suspended</Tr></Badge> : <Badge tone="success"><Tr>Active</Tr></Badge>}{!u.emailVerifiedAt && <Badge tone="warning"><Tr>Unverified</Tr></Badge>}{u.platformRole === "SUPER_ADMIN" && <Badge tone="accent"><Tr>Admin</Tr></Badge>}</div></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(f ? { f } : {}), page: String(p) })}`} />
    </>
  );
}
