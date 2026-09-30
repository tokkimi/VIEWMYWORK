import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { ListCard } from "@/components/app/blocks";
import { InvoiceStatusBadge } from "@/components/status";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";

export default async function ProjectInvoices({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, perms } = await loadProject(id);
  if (!hasLevel(perms, "invoices", "view")) notFound();
  const invoices = await db.invoice.findMany({ where: { workspaceId: ctx.workspace.id, projectId: id }, orderBy: { issueDate: "desc" } });
  return (
    <div className="space-y-5">
      {hasLevel(perms, "invoices", "edit") && <div className="flex justify-end"><ButtonLink href={`/app/invoices/new?projectId=${id}`} variant="primary"><Plus className="size-4" />Create invoice</ButtonLink></div>}
      {invoices.length === 0 ? <EmptyState icon={<Receipt />} title="No invoices yet" description="Create your first invoice and send it directly to your client." /> : (
        <ListCard>
          {invoices.map((i) => (
            <Link key={i.id} href={`/app/invoices/${i.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-white/[0.02] sm:grid-cols-[140px_1fr_120px_120px_110px]">
              <span className="num font-medium">{i.number ?? "Draft"}</span>
              <span className="hidden text-muted sm:block">Issued {fmtDate(i.issueDate)}</span>
              <span className="hidden text-muted sm:block">Due {fmtDate(i.dueDate)}</span>
              <span className="num text-right">{formatMoney(i.totalCents, i.currency)}{outstandingCents(i) > 0 && i.paidCents > 0 && <span className="block text-[11px] text-subtle">{formatMoney(outstandingCents(i), i.currency)} due</span>}</span>
              <span className="text-right"><InvoiceStatusBadge s={deriveStatus(i)} /></span>
            </Link>
          ))}
        </ListCard>
      )}
    </div>
  );
}
