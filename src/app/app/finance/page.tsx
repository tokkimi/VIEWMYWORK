import Link from "next/link";
import { Wallet, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, can, projectScope } from "@/lib/auth/context";
import { PageHeader, Section, Stat, EmptyState, Badge } from "@/components/ui/primitives";
import { ListCard } from "@/components/app/blocks";
import { ExpenseDialog, DeleteExpenseButton } from "@/components/app/finance-forms";
import { BarChart } from "@/components/charts";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { hasFeature } from "@/lib/plans";
import { outstandingCents } from "@/lib/invoices/status";
import { inputClass } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Finance" };

function monthKey(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; }

export default async function Finance({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "finance", "view");
  const sp = await searchParams;
  const cur = ctx.workspace.defaultCurrency;
  const ws = ctx.workspace.id;
  const now = new Date();
  const start12 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [payments, expenses12, expensesList, open, budgets, projects, exportsAllowed] = await Promise.all([
    db.payment.findMany({ where: { workspaceId: ws, currency: cur, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] }, paidAt: { gte: start12 } }, select: { amountCents: true, refundedCents: true, paidAt: true } }),
    db.expense.findMany({ where: { workspaceId: ws, currency: cur, date: { gte: start12 } }, select: { amountCents: true, date: true } }),
    db.expense.findMany({ where: { workspaceId: ws }, include: { project: { select: { name: true } } }, orderBy: { date: "desc" }, take: 50 }),
    db.invoice.findMany({ where: { workspaceId: ws, currency: cur, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] } }, select: { totalCents: true, paidCents: true, dueDate: true } }),
    db.project.aggregate({ where: { workspaceId: ws, currency: cur, archivedAt: null, status: { in: ["ACTIVE", "PLANNING", "ON_HOLD"] } }, _sum: { budgetCents: true } }),
    db.project.findMany({ where: { ...projectScope(ctx), archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    hasFeature(ws, "accounting_exports"),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1))));
  const rev = new Map(months.map((m) => [m, 0]));
  const exp = new Map(months.map((m) => [m, 0]));
  for (const p of payments) if (p.paidAt) rev.set(monthKey(p.paidAt), (rev.get(monthKey(p.paidAt)) ?? 0) + p.amountCents - p.refundedCents);
  for (const e of expenses12) exp.set(monthKey(e.date), (exp.get(monthKey(e.date)) ?? 0) + e.amountCents);
  const ytdRevenue = payments.filter((p) => p.paidAt && p.paidAt >= yearStart).reduce((a, p) => a + p.amountCents - p.refundedCents, 0);
  const ytdExpenses = expenses12.filter((e) => e.date >= yearStart).reduce((a, e) => a + e.amountCents, 0);
  const outstanding = open.reduce((a, i) => a + outstandingCents(i), 0);
  const overdue = open.filter((i) => i.dueDate < now).reduce((a, i) => a + outstandingCents(i), 0);

  return (
    <>
      <PageHeader title="Finance" description={`Client revenue, expenses and margin in ${cur}.`} actions={can(ctx, "finance", "edit") ? <ExpenseDialog projects={projects} currency={cur} openInitially={sp.new === "expense"} /> : undefined} />
      <div className="panel mb-10 grid grid-cols-2 divide-line overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-line [&>*:not(:last-child)]:border-r">
        <Stat label="Active budgets" value={formatMoney(budgets._sum.budgetCents ?? 0, cur)} />
        <Stat label="Revenue (YTD)" value={formatMoney(ytdRevenue, cur)} />
        <Stat label="Outstanding" value={formatMoney(outstanding, cur)} />
        <Stat label="Overdue" value={formatMoney(overdue, cur)} tone={overdue ? "danger" : undefined} />
        <Stat label="Expenses (YTD)" value={formatMoney(ytdExpenses, cur)} />
        <Stat label="Estimated margin" value={formatMoney(ytdRevenue - ytdExpenses, cur)} tone={ytdRevenue - ytdExpenses < 0 ? "danger" : undefined} hint="YTD" />
      </div>
      <div className="grid gap-10 xl:grid-cols-2">
        <Section title="Payments received" description="Last 12 months"><div className="panel rounded-2xl p-5"><BarChart data={months.map((m) => ({ label: m.slice(5), value: rev.get(m)! }))} format={(v) => formatMoney(v, cur)} /></div></Section>
        <Section title="Expenses" description="Last 12 months"><div className="panel rounded-2xl p-5"><BarChart data={months.map((m) => ({ label: m.slice(5), value: exp.get(m)! }))} format={(v) => formatMoney(v, cur)} muted /></div></Section>
      </div>

      <Section title="Accounting exports" className="mt-10" description="Invoices, payments, expenses and taxes for your accountant. Client revenue only — never platform billing.">
        {exportsAllowed ? (
          <form action="/api/exports/accounting" method="get" className="panel flex flex-wrap items-end gap-3 rounded-2xl p-4">
            <label className="text-xs text-muted">Period<select name="period" defaultValue="this_month" className={`${inputClass} mt-1 w-40`}><option value="this_month">This month</option><option value="last_month">Last month</option><option value="quarter">This quarter</option><option value="year">This year</option><option value="custom">Custom</option></select></label>
            <label className="text-xs text-muted">From (custom)<input type="date" name="from" className={`${inputClass} mt-1 w-40`} /></label>
            <label className="text-xs text-muted">To (custom)<input type="date" name="to" className={`${inputClass} mt-1 w-40`} /></label>
            <button name="format" value="csv" className={buttonClass("secondary")}><Download className="size-4" />CSV</button>
            <button name="format" value="pdf" className={buttonClass("secondary")}><Download className="size-4" />PDF</button>
          </form>
        ) : (
          <p className="panel rounded-2xl px-4 py-4 text-sm text-muted">Accounting exports are available on higher plans. <Link href="/app/settings/billing" className="text-accent hover:underline">Upgrade</Link></p>
        )}
      </Section>

      <Section title="Recent expenses" className="mt-10">
        {expensesList.length === 0 ? <EmptyState icon={<Wallet />} title="No expenses yet" description="Track software, freelancers, travel, materials and ads to see your real margin." /> : (
          <ListCard>
            {expensesList.map((e) => (
              <div key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_130px_150px_110px_120px_56px]">
                <div className="min-w-0"><div className="truncate">{e.name}</div><div className="truncate text-xs text-subtle">{e.supplier ?? "—"}</div></div>
                <span className="hidden sm:block"><Badge>{EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] ?? e.category}</Badge></span>
                <span className="hidden truncate text-muted sm:block">{e.project?.name ?? "—"}</span>
                <span className="hidden text-muted sm:block">{fmtDate(e.date)}</span>
                <span className="num text-right">{formatMoney(e.amountCents, e.currency)}</span>
                {can(ctx, "finance", "edit") && <span className="hidden justify-end gap-1 sm:flex"><ExpenseDialog projects={projects} currency={cur} expense={e} /><DeleteExpenseButton id={e.id} /></span>}
              </div>
            ))}
          </ListCard>
        )}
      </Section>
    </>
  );
}
