import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, projectScope } from "@/lib/auth/context";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { InvoiceEditor } from "@/components/app/invoice-editor";
import { formatInvoiceNumber } from "@/lib/invoices/numbering";
import { centsToInput } from "@/lib/money";
import { clientDisplayName } from "@/server/services/invoices";
import { Users } from "lucide-react";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("New invoice");

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ clientId?: string; projectId?: string }> }) {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "invoices", "edit");
  const sp = await searchParams;
  const [clients, projects, settings] = await Promise.all([
    db.client.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, orderBy: { company: "asc" } }),
    db.project.findMany({ where: { ...projectScope(ctx), archivedAt: null }, select: { id: true, name: true, clientId: true, budgetCents: true } }),
    db.invoiceSettings.upsert({ where: { workspaceId: ctx.workspace.id }, create: { workspaceId: ctx.workspace.id }, update: {} }),
  ]);
  if (!clients.length)
    return (
      <>
        <PageHeader title="New invoice" />
        <EmptyState icon={<Users />} title="Add a client first" description="Invoices are issued to a client." action={<ButtonLink href="/app/clients/new" variant="primary"><Tr>Add client</Tr></ButtonLink>} />
      </>
    );
  const project = projects.find((p) => p.id === sp.projectId);
  const clientId = project?.clientId ?? clients.find((c) => c.id === sp.clientId)?.id ?? clients[0].id;
  const client = clients.find((c) => c.id === clientId)!;
  const now = new Date();
  const counter = await db.invoiceCounter.findUnique({ where: { workspaceId_scope: { workspaceId: ctx.workspace.id, scope: settings.includeYear ? String(now.getUTCFullYear()) : "ALL" } } });
  const preview = formatInvoiceNumber(settings.prefix, settings.includeYear, now.getUTCFullYear(), Math.max(settings.nextNumber, (counter?.last ?? 0) + 1), settings.padding);

  return (
    <>
      <PageHeader title="New invoice" eyebrow="Invoices" />
      <InvoiceEditor
        clients={clients.map((c) => ({ id: c.id, name: clientDisplayName(c), currency: c.currency }))}
        projects={projects}
        numberPreview={preview}
        initial={{
          clientId,
          projectId: project?.id ?? null,
          currency: client.currency || settings.defaultCurrency,
          issueDate: now,
          dueDate: new Date(now.getTime() + settings.defaultDueDays * 86400_000),
          notes: settings.defaultNotes,
          terms: settings.defaultTerms,
          footer: settings.footer,
          lines: [{ description: project ? project.name : "", quantity: 1, unitPrice: project?.budgetCents ? centsToInput(project.budgetCents) : "", taxRate: settings.defaultTaxRateBps / 100, discount: 0 }],
        }}
      />
    </>
  );
}
