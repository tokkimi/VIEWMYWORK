import Link from "next/link";
import { Suspense } from "react";
import { Plus, Receipt } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, can } from "@/lib/auth/context";
import { PageHeader, EmptyState, Table, th, td } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { InvoiceStatusBadge } from "@/components/status";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";
import { clientDisplayName } from "@/server/services/invoices";
import { pageTitle, getI18n } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Invoices");
const PER_PAGE = 25;

export default async function Invoices({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  const { t, fmt } = await getI18n();
  const ctx = await requireWorkspace();
  requirePerm(ctx, "invoices", "view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const payable = ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] as const;
  const filters: Record<string, Prisma.InvoiceWhereInput> = {
    draft: { status: "DRAFT" },
    unpaid: { status: { in: [...payable] } },
    overdue: { status: { in: [...payable] }, dueDate: { lt: today } },
    paid: { status: "PAID" },
    void: { status: { in: ["VOID", "REFUNDED"] } },
  };
  const where: Prisma.InvoiceWhereInput = { workspaceId: ctx.workspace.id, ...(filters[sp.status ?? ""] ?? {}) };
  if (sp.q) where.OR = [{ number: { contains: sp.q, mode: "insensitive" } }, { client: { company: { contains: sp.q, mode: "insensitive" } } }, { client: { lastName: { contains: sp.q, mode: "insensitive" } } }];

  const [total, invoices, counts] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, include: { client: true, project: { select: { name: true } } }, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    Promise.all(["draft", "unpaid", "overdue"].map((k) => db.invoice.count({ where: { workspaceId: ctx.workspace.id, ...filters[k] } }))),
  ]);
  const base = (s?: string) => `/app/invoices${s ? `?status=${s}` : ""}`;

  return (
    <>
      <PageHeader title="Invoices" description="Create, send and track invoices. Clients pay online from their portal." actions={can(ctx, "invoices", "edit") ? <ButtonLink href="/app/invoices/new" variant="primary"><Plus className="size-4" /><Tr>Create invoice</Tr></ButtonLink> : undefined} />
      <Suspense>
        <LinkTabs
          tabs={[
            { href: base(), label: "All" },
            { href: base("draft"), label: "Drafts", count: counts[0] },
            { href: base("unpaid"), label: "Unpaid", count: counts[1] },
            { href: base("overdue"), label: "Overdue", count: counts[2] },
            { href: base("paid"), label: "Paid" },
            { href: base("void"), label: "Void & refunded" },
          ]}
          exact
        />
      </Suspense>
      {invoices.length === 0 ? (
        <EmptyState icon={<Receipt />} title={sp.status ? t("No invoices here") : t("No invoices yet")} description="Create your first invoice and send it directly to your client." action={can(ctx, "invoices", "edit") ? <ButtonLink href="/app/invoices/new" variant="primary"><Tr>Create invoice</Tr></ButtonLink> : undefined} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}><Tr>Invoice</Tr></th>
                <th className={th}><Tr>Client</Tr></th>
                <th className={th}><Tr>Project</Tr></th>
                <th className={th}><Tr>Issued</Tr></th>
                <th className={th}><Tr>Due</Tr></th>
                <th className={`${th} text-right`}><Tr>Amount</Tr></th>
                <th className={`${th} text-right`}><Tr>Status</Tr></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const s = deriveStatus(i);
                return (
                  <tr key={i.id} className="hover:bg-white/[0.02]">
                    <td className={td}><Link href={`/app/invoices/${i.id}`} className="num font-medium hover:underline">{i.number ?? t("Draft")}</Link></td>
                    <td className={`${td} text-muted`}>{clientDisplayName(i.client)}</td>
                    <td className={`${td} text-muted`}>{i.project?.name ?? "—"}</td>
                    <td className={`${td} text-muted`}>{fmt.date(i.issueDate)}</td>
                    <td className={`${td} ${s === "OVERDUE" ? "text-danger" : "text-muted"}`}>{fmt.date(i.dueDate)}</td>
                    <td className={`${td} num text-right`}>
                      {fmt.money(i.totalCents, i.currency)}
                      {s === "PARTIALLY_PAID" && <div className="text-[11px] text-subtle">{fmt.money(outstandingCents(i), i.currency)} <Tr>due</Tr></div>}
                    </td>
                    <td className={`${td} text-right`}><InvoiceStatusBadge s={s} /></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/app/invoices?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
