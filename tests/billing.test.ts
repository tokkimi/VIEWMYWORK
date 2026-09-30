import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspace, signIn, fd } from "./helpers";
import { allocateInvoiceNumber } from "@/lib/invoices/numbering";
import { saveInvoiceAction, sendInvoiceAction, recordManualPaymentAction } from "@/server/actions/invoices";
import { recordStripePayment, claimWebhookEvent } from "@/server/services/payments";

const lines = (price: string) => JSON.stringify([{ description: "Work", quantity: 1, unitPrice: price, taxRate: 20, discount: 0 }]);

async function issuedInvoice() {
  const a = await makeWorkspace();
  await signIn(a.owner.id, { workspaceId: a.ws.id });
  const created = await saveInvoiceAction(fd({ clientId: a.client.id, currency: "EUR", issueDate: "2026-09-01", dueDate: "2099-10-01", lines: lines("1000"), totalCents: 1 }));
  if (!created.ok) throw new Error(created.error);
  const id = (created.data as { id: string }).id;
  const sent = await sendInvoiceAction(fd({ id, to: a.client.email, subject: "Invoice" }));
  if (!sent.ok) throw new Error(sent.error);
  return { a, id };
}

describe("invoices", () => {
  it("ignores browser totals and recomputes server-side", async () => {
    const { id } = await issuedInvoice();
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    expect(inv.subtotalCents).toBe(100000);
    expect(inv.taxCents).toBe(20000);
    expect(inv.totalCents).toBe(120000);
    expect(inv.number).toMatch(/^INV-\d{4}-0001$/);
    expect(inv.sellerSnapshot).toBeTruthy();
  });
  it("snapshots client billing details at issue time", async () => {
    const { a, id } = await issuedInvoice();
    await db.client.update({ where: { id: a.client.id }, data: { billingAddress: "New address", email: "changed@x.dev" } });
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    expect(JSON.stringify(inv.clientSnapshot)).not.toContain("New address");
  });
  it("never allocates duplicate numbers under concurrency", async () => {
    const a = await makeWorkspace();
    const numbers = await Promise.all(Array.from({ length: 25 }, () => db.$transaction((tx) => allocateInvoiceNumber(tx, a.ws.id))));
    expect(new Set(numbers).size).toBe(25);
  });
  it("supports multiple partial payments and blocks overpayment", async () => {
    const { id } = await issuedInvoice();
    expect((await recordManualPaymentAction(fd({ invoiceId: id, amount: "500", date: "2026-09-10", method: "BANK_TRANSFER" }))).ok).toBe(true);
    expect((await db.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("PARTIALLY_PAID");
    // 500 already paid on 1200: two concurrent 400 payments — row locking lets exactly one through
    const [r1, r2] = await Promise.all([
      recordManualPaymentAction(fd({ invoiceId: id, amount: "400", date: "2026-09-11", method: "CASH" })),
      recordManualPaymentAction(fd({ invoiceId: id, amount: "400", date: "2026-09-11", method: "CASH" })),
    ]);
    expect([r1.ok, r2.ok].filter(Boolean).length).toBe(1);
    const after = await db.invoice.findUniqueOrThrow({ where: { id } });
    expect(after.paidCents).toBe(90000);
    expect(after.paidCents).toBe((await db.payment.aggregate({ where: { invoiceId: id }, _sum: { amountCents: true } }))._sum.amountCents);
    const over = await recordManualPaymentAction(fd({ invoiceId: id, amount: "999999", date: "2026-09-12", method: "CASH" }));
    expect(over.ok).toBe(false);
  });
});

describe("payment webhooks", () => {
  it("is idempotent: duplicate event ids and duplicate payment intents record once", async () => {
    const { a, id } = await issuedInvoice();
    await db.paymentAccount.create({ data: { workspaceId: a.ws.id, stripeAccountId: `acct_${id.slice(0, 8)}`, chargesEnabled: true } });
    const evt = `evt_${id}`;
    expect(await claimWebhookEvent(evt, "stripe_connect", "checkout.session.completed")).toBe(true);
    expect(await claimWebhookEvent(evt, "stripe_connect", "checkout.session.completed")).toBe(false);
    await recordStripePayment(`acct_${id.slice(0, 8)}`, id, a.ws.id, `pi_${id}`, 120000, "EUR", "cs_1");
    await recordStripePayment(`acct_${id.slice(0, 8)}`, id, a.ws.id, `pi_${id}`, 120000, "EUR", "cs_1");
    expect(await db.payment.count({ where: { invoiceId: id } })).toBe(1);
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    expect(inv.status).toBe("PAID");
    expect(inv.paidCents).toBe(120000);
  });
  it("rejects events from a connected account that doesn't own the invoice", async () => {
    const { a, id } = await issuedInvoice();
    await expect(recordStripePayment("acct_attacker", id, a.ws.id, `pi_x_${id}`, 1, "EUR", "cs")).rejects.toThrow();
    expect(await db.payment.count({ where: { invoiceId: id } })).toBe(0);
  });
});

describe("checkout", () => {
  it("uses the database amount, never a client-supplied one", async () => {
    const { a, id } = await issuedInvoice();
    await db.paymentAccount.create({ data: { workspaceId: a.ws.id, stripeAccountId: `acct_c_${id.slice(0, 8)}`, chargesEnabled: true } });
    const create = vi.fn(async () => ({ url: "https://checkout.stripe.test/s" }));
    vi.doMock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { create } } }) }));
    vi.resetModules();
    const { createInvoiceCheckout } = await import("@/server/services/payments");
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    await createInvoiceCheckout(inv.publicToken, "public");
    const args = (create.mock.calls[0] as unknown as [{ line_items: { price_data: { unit_amount: number; currency: string } }[] }, { stripeAccount: string }]);
    expect(args[0].line_items[0].price_data.unit_amount).toBe(120000);
    expect(args[0].line_items[0].price_data.currency).toBe("eur");
    expect(args[1].stripeAccount).toBe(`acct_c_${id.slice(0, 8)}`);
    vi.doUnmock("@/lib/stripe");
  });
});
