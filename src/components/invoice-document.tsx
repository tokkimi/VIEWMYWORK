import type { InvoiceLineItem, InvoiceStatus } from "@prisma/client";
import { formatQuantity, formatRate } from "@/lib/invoices/calc";
import { InvoiceStatusBadge } from "@/components/status";
import type { ClientSnapshot, SellerSnapshot } from "@/server/services/invoices";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

/** On-screen invoice, mirroring the PDF layout. Used by the app, the portal and the public link. */
export async function InvoiceDocument({ inv, seller, client, lines, status, projectName }: { inv: { number: string | null; currency: string; issueDate: Date; dueDate: Date; subtotalCents: number; discountCents: number; taxCents: number; totalCents: number; paidCents: number; notes: string | null; terms: string | null; footer: string | null }; seller: SellerSnapshot; client: ClientSnapshot; lines: InvoiceLineItem[]; status: InvoiceStatus; projectName?: string | null }) {
  const { t, fmt } = await getI18n();
  const m = (c: number) => fmt.moneyExact(c, inv.currency);
  const due = Math.max(0, inv.totalCents - inv.paidCents);
  return (
    <article className="panel overflow-hidden rounded-2xl" aria-label={t("Invoice {number}", { number: inv.number ?? t("Draft") })}>
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line p-6 sm:p-8">
        <div>
          {seller.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.logoUrl} alt={seller.name} className="h-9 max-w-[180px] object-contain" />
          ) : (
            <div className="text-lg font-semibold">{seller.name}</div>
          )}
        </div>
        <div className="text-right">
          <div className="eyebrow"><Tr>Invoice</Tr></div>
          <div className="num mt-1 text-lg font-semibold">{inv.number ?? t("Draft")}</div>
          <div className="mt-2"><InvoiceStatusBadge s={status} /></div>
        </div>
      </div>
      <div className="grid gap-6 border-b border-line p-6 text-sm sm:grid-cols-2 sm:p-8">
        <div>
          <div className="eyebrow mb-2"><Tr>From</Tr></div>
          <div className="font-medium">{seller.legalName || seller.name}</div>
          <div className="whitespace-pre-line text-muted">{[seller.address, seller.country, seller.email, seller.phone].filter(Boolean).join("\n")}</div>
          {seller.vatNumber && <div className="text-muted">VAT: {seller.vatNumber}</div>}
          {seller.registration && <div className="text-muted">Reg: {seller.registration}</div>}
        </div>
        <div className="sm:text-right">
          <div className="eyebrow mb-2"><Tr>Bill to</Tr></div>
          <div className="font-medium">{client.company || client.name}</div>
          <div className="whitespace-pre-line text-muted">{[client.company ? client.name : null, client.address, client.country, client.email].filter(Boolean).join("\n")}</div>
          {client.vatNumber && <div className="text-muted">VAT: {client.vatNumber}</div>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-b border-line px-6 py-4 text-sm sm:grid-cols-4 sm:px-8">
        <div><dt className="text-xs text-muted"><Tr>Issue date</Tr></dt><dd className="mt-0.5">{fmt.date(inv.issueDate)}</dd></div>
        <div><dt className="text-xs text-muted"><Tr>Due date</Tr></dt><dd className="mt-0.5">{fmt.date(inv.dueDate)}</dd></div>
        {projectName && <div><dt className="text-xs text-muted"><Tr>Project</Tr></dt><dd className="mt-0.5 truncate">{projectName}</dd></div>}
        <div><dt className="text-xs text-muted"><Tr>Amount due</Tr></dt><dd className="num mt-0.5 font-medium">{m(due)}</dd></div>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-subtle">
              <th className="px-6 py-3 font-medium sm:px-8"><Tr>Description</Tr></th>
              <th className="px-3 py-3 text-right font-medium"><Tr>Qty</Tr></th>
              <th className="px-3 py-3 text-right font-medium"><Tr>Unit price</Tr></th>
              <th className="px-3 py-3 text-right font-medium"><Tr>Tax</Tr></th>
              <th className="px-6 py-3 text-right font-medium sm:px-8"><Tr>Amount</Tr></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-line align-top">
                <td className="whitespace-pre-line px-6 py-3 sm:px-8">{l.description}{l.discountBps ? <span className="block text-xs text-muted"><Tr>Discount</Tr> {formatRate(l.discountBps)}</span> : null}</td>
                <td className="num px-3 py-3 text-right">{formatQuantity(l.quantityMilli)}</td>
                <td className="num px-3 py-3 text-right">{m(l.unitPriceCents)}</td>
                <td className="num px-3 py-3 text-right text-muted">{l.taxRateBps ? formatRate(l.taxRateBps) : "—"}</td>
                <td className="num px-6 py-3 text-right sm:px-8">{m(l.lineSubtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-line p-6 sm:p-8">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          {inv.discountCents > 0 && <div className="flex justify-between text-muted"><dt><Tr>Discount</Tr></dt><dd className="num">− {m(inv.discountCents)}</dd></div>}
          <div className="flex justify-between text-muted"><dt><Tr>Subtotal</Tr></dt><dd className="num">{m(inv.subtotalCents)}</dd></div>
          <div className="flex justify-between text-muted"><dt><Tr>Tax</Tr></dt><dd className="num">{m(inv.taxCents)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt><Tr>Total</Tr></dt><dd className="num">{m(inv.totalCents)}</dd></div>
          {inv.paidCents > 0 && (
            <>
              <div className="flex justify-between text-success"><dt><Tr>Paid</Tr></dt><dd className="num">− {m(inv.paidCents)}</dd></div>
              <div className="flex justify-between font-semibold"><dt><Tr>Amount due</Tr></dt><dd className="num">{m(due)}</dd></div>
            </>
          )}
        </dl>
      </div>
      {(inv.terms || seller.bankDetails || inv.notes) && (
        <div className="grid gap-6 border-t border-line p-6 text-sm sm:grid-cols-2 sm:p-8">
          {(inv.terms || seller.bankDetails) && (
            <div>
              <div className="eyebrow mb-2"><Tr>Payment information</Tr></div>
              <p className="whitespace-pre-line text-muted">{[inv.terms, seller.bankDetails].filter(Boolean).join("\n\n")}</p>
            </div>
          )}
          {inv.notes && (
            <div>
              <div className="eyebrow mb-2"><Tr>Notes</Tr></div>
              <p className="whitespace-pre-line text-muted">{inv.notes}</p>
            </div>
          )}
        </div>
      )}
      {inv.footer && <div className="border-t border-line px-6 py-4 text-xs text-subtle sm:px-8">{inv.footer}</div>}
    </article>
  );
}
