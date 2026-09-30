import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, projectScope } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/primitives";
import { InvoiceEditor } from "@/components/app/invoice-editor";
import { centsToInput } from "@/lib/money";
import { clientDisplayName, loadInvoice } from "@/server/services/invoices";
import { pageTitle, getI18n } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Edit invoice");

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const ctx = await requireWorkspace();
  requirePerm(ctx, "invoices", "edit");
  const { id } = await params;
  const inv = await loadInvoice(ctx, id);
  if (inv.status !== "DRAFT") redirect(`/app/invoices/${id}`);
  const [clients, projects] = await Promise.all([
    db.client.findMany({ where: { workspaceId: ctx.workspace.id, OR: [{ archivedAt: null }, { id: inv.clientId }] }, orderBy: { company: "asc" } }),
    db.project.findMany({ where: { ...projectScope(ctx) }, select: { id: true, name: true, clientId: true } }),
  ]);
  return (
    <>
      <PageHeader title="Edit draft invoice" eyebrow="Invoices" />
      <InvoiceEditor
        clients={clients.map((c) => ({ id: c.id, name: clientDisplayName(c), currency: c.currency }))}
        projects={projects}
        numberPreview={t("Assigned on send")}
        initial={{
          id: inv.id,
          clientId: inv.clientId,
          projectId: inv.projectId,
          currency: inv.currency,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          notes: inv.notes,
          terms: inv.terms,
          footer: inv.footer,
          lines: inv.lineItems.map((l) => ({ description: l.description, quantity: l.quantityMilli / 1000, unitPrice: centsToInput(l.unitPriceCents), taxRate: l.taxRateBps / 100, discount: l.discountBps / 100 })),
        }}
      />
    </>
  );
}
