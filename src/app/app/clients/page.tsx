import Link from "next/link";
import { Suspense } from "react";
import { Plus, Users, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, can } from "@/lib/auth/context";
import { PageHeader, EmptyState, Avatar, Badge, Table, th, td } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { inputClass } from "@/components/ui/form";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Clients");
const PER_PAGE = 30;

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string; tag?: string; page?: string }> }) {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  requirePerm(ctx, "clients", "view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ClientWhereInput = { workspaceId: ctx.workspace.id, archivedAt: sp.archived ? { not: null } : null };
  if (sp.q) where.OR = ["firstName", "lastName", "company", "email"].map((f) => ({ [f]: { contains: sp.q, mode: "insensitive" } }));
  if (sp.tag) where.tags = { has: sp.tag };
  const [total, clients, tags] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({
      where,
      orderBy: [{ company: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        projects: { where: { archivedAt: null, status: { in: ["ACTIVE", "PLANNING", "ON_HOLD"] } }, select: { id: true, progress: true } },
        invoices: can(ctx, "invoices", "view") ? { where: { status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } }, select: { totalCents: true, paidCents: true, currency: true } } : false,
        portalAccess: { where: { revokedAt: null }, select: { id: true } },
      },
    }),
    db.client.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, select: { tags: true } }),
  ]);
  const allTags = [...new Set(tags.flatMap((t) => t.tags))].sort();

  return (
    <>
      <PageHeader title="Clients" description="Everyone you work for, their projects, files and invoices." actions={can(ctx, "clients", "edit") ? <ButtonLink href="/app/clients/new" variant="primary"><Plus className="size-4" /><Tr>Add client</Tr></ButtonLink> : undefined} />
      <Suspense>
        <LinkTabs tabs={[{ href: "/app/clients", label: "Active" }, { href: "/app/clients?archived=1", label: "Archived" }]} exact />
      </Suspense>
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        {sp.archived && <input type="hidden" name="archived" value="1" />}
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input name="q" defaultValue={sp.q} placeholder={t("Search clients…")} aria-label={t("Search clients")} className={`${inputClass} pl-9`} />
        </div>
        {allTags.length > 0 && (
          <select name="tag" defaultValue={sp.tag ?? ""} aria-label={t("Filter by tag")} className={`${inputClass} w-auto`}>
            <option value="">{t("All tags")}</option>
            {allTags.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <button className="h-9 rounded-[10px] border border-line px-3 text-sm text-muted hover:text-fg"><Tr>Filter</Tr></button>
      </form>
      {clients.length === 0 ? (
        <EmptyState icon={<Users />} title={sp.q || sp.tag ? t("No matching clients") : sp.archived ? t("No archived clients") : t("No clients yet")} description={sp.q ? undefined : t("Add a client, create their project and invite them to a portal they'll love.")} action={!sp.q && !sp.archived && can(ctx, "clients", "edit") ? <ButtonLink href="/app/clients/new" variant="primary"><Tr>Add client</Tr></ButtonLink> : undefined} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}><Tr>Client</Tr></th>
                <th className={th}><Tr>Email</Tr></th>
                <th className={th}><Tr>Active projects</Tr></th>
                {can(ctx, "invoices", "view") && <th className={`${th} text-right`}><Tr>Outstanding</Tr></th>}
                <th className={`${th} text-right`}><Tr>Portal</Tr></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const out = (c.invoices || []).reduce((a, i) => a + Math.max(0, i.totalCents - i.paidCents), 0);
                return (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className={td}>
                      <Link href={`/app/clients/${c.id}`} className="flex items-center gap-3">
                        <Avatar name={c.company || `${c.firstName} ${c.lastName}`} src={c.avatarUrl} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{c.company || `${c.firstName} ${c.lastName}`}</span>
                          {c.company && <span className="block truncate text-xs text-muted">{c.firstName} {c.lastName}</span>}
                        </span>
                        {c.tags.slice(0, 2).map((t) => <Badge key={t}>{t}</Badge>)}
                      </Link>
                    </td>
                    <td className={`${td} text-muted`}>{c.email}</td>
                    <td className={`${td} num text-muted`}>{c.projects.length}</td>
                    {can(ctx, "invoices", "view") && <td className={`${td} num text-right ${out ? "" : "text-subtle"}`}>{out ? fmt.money(out, c.currency) : "—"}</td>}
                    <td className={`${td} text-right`}>{c.portalAccess.length ? <Badge tone="success"><Tr>Active</Tr></Badge> : <span className="text-xs text-subtle"><Tr>Not invited</Tr></span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/app/clients?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.archived ? { archived: "1" } : {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
