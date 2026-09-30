import { db } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { deriveStatus } from "@/lib/invoices/status";
import { invoiceParties } from "./invoices";

/** Renders an invoice PDF on demand (no storage cost). Caller MUST have authorised access. */
export async function invoicePdfResponse(invoiceId: string, disposition: "inline" | "attachment" = "attachment") {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { client: true, lineItems: { orderBy: { position: "asc" } }, project: true } });
  const { seller, client } = await invoiceParties(inv);
  const pdf = await renderInvoicePdf({ ...inv, status: deriveStatus(inv), seller, client, lines: inv.lineItems, projectName: inv.project?.name, locale: inv.client.preferredLanguage });
  const name = `${inv.number ?? "draft-invoice"}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
