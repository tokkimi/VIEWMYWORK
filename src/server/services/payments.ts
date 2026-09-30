import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { AppError } from "@/lib/errors";
import { outstandingCents, isPayable } from "@/lib/invoices/status";
import { env } from "@/lib/env";
import { recomputeInvoice } from "./invoices";
import { afterPayment } from "./billing";
import { emit } from "@/lib/events";

/**
 * DOMAIN B — client invoice payments. Money goes to the professional's own Stripe
 * Connect account (direct charges); the platform account never receives client revenue.
 * Amount, currency and ownership always come from the database, never from the browser.
 */
export async function createInvoiceCheckout(publicToken: string, returnPath: "public" | "portal") {
  const inv = await db.invoice.findUnique({ where: { publicToken }, include: { client: true, workspace: { include: { paymentAccount: true } } } });
  if (!inv) throw new AppError("Invoice not found.", "NOT_FOUND");
  if (!isPayable(inv.status)) throw new AppError("This invoice can't be paid online.");
  const amount = outstandingCents(inv);
  if (amount <= 0) throw new AppError("This invoice is already paid.");
  const acct = inv.workspace.paymentAccount;
  if (!acct?.chargesEnabled) throw new AppError("Online payment isn't enabled for this invoice. Please use the payment details on the invoice.", "CONFIG");
  const stripe = getStripe();
  const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 0);
  const base = returnPath === "portal" ? `${env.appUrl}/portal/invoices/${inv.id}` : `${env.appUrl}/i/${inv.publicToken}`;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: inv.client.billingEmail || inv.client.email,
      line_items: [{ quantity: 1, price_data: { currency: inv.currency.toLowerCase(), unit_amount: amount, product_data: { name: `Invoice ${inv.number}`, description: inv.workspace.name } } }],
      metadata: { invoiceId: inv.id, workspaceId: inv.workspaceId, kind: "client_invoice" },
      payment_intent_data: {
        metadata: { invoiceId: inv.id, workspaceId: inv.workspaceId, kind: "client_invoice" },
        ...(feeBps > 0 ? { application_fee_amount: Math.floor((amount * feeBps) / 10000) } : {}),
      },
      success_url: `${base}?payment=success`,
      cancel_url: `${base}?payment=cancelled`,
    },
    { stripeAccount: acct.stripeAccountId, idempotencyKey: `inv_${inv.id}_${amount}_${Math.floor(Date.now() / 60000)}` },
  );
  if (!session.url) throw new AppError("Couldn't start the payment. Please try again.");
  return session.url;
}

/** Idempotent: records a provider event id once; returns false if already processed. */
export async function claimWebhookEvent(id: string, provider: string, type: string) {
  const r = await db.webhookEvent.createMany({ data: [{ id, provider, type }], skipDuplicates: true });
  return r.count === 1;
}

export async function handleConnectEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.kind !== "client_invoice" || s.payment_status !== "paid") return;
      await recordStripePayment(event.account!, s.metadata.invoiceId, s.metadata.workspaceId, String(s.payment_intent), s.amount_total ?? 0, (s.currency ?? "").toUpperCase(), s.id);
      return;
    }
    case "checkout.session.async_payment_failed":
    case "payment_intent.payment_failed": {
      const obj = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session;
      const md = obj.metadata;
      if (md?.kind !== "client_invoice") return;
      const inv = await db.invoice.findFirst({ where: { id: md.invoiceId, workspaceId: md.workspaceId, workspace: { paymentAccount: { stripeAccountId: event.account } } } });
      if (!inv) return;
      await emit({
        workspaceId: inv.workspaceId, type: "PAYMENT_FAILED", actor: null, projectId: inv.projectId, clientId: inv.clientId, entityType: "INVOICE", entityId: inv.id,
        summary: ["Online payment attempt failed for {number}", { number: inv.number }],
        notify: { team: { kind: "workspace", capability: ["invoices", "view"] }, title: "Payment failed", message: ["A payment attempt for invoice {number} failed.", { number: inv.number }], actionUrl: `/app/invoices/${inv.id}`, actionLabel: "Open invoice" },
      });
      return;
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (!pi) return;
      const payment = await db.payment.findUnique({ where: { providerPaymentId: pi }, include: { workspace: { include: { paymentAccount: true } } } });
      if (!payment || payment.workspace.paymentAccount?.stripeAccountId !== event.account) return;
      const refunded = Math.min(ch.amount_refunded, payment.amountCents);
      const { invoice } = await db.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { refundedCents: refunded, status: refunded >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
        return recomputeInvoice(tx, payment.invoiceId);
      });
      await emit({
        workspaceId: payment.workspaceId, type: "REFUND_ISSUED", actor: null, projectId: invoice.projectId, clientId: invoice.clientId, entityType: "INVOICE", entityId: invoice.id,
        summary: ["Refund of {amount} processed for {number}", { amount: { money: refunded, currency: payment.currency }, number: invoice.number }], clientVisible: true,
        notify: { team: { kind: "workspace", capability: ["invoices", "view"] }, client: true, title: "Refund processed", message: ["{amount} was refunded for invoice {number}.", { amount: { money: refunded, currency: payment.currency }, number: invoice.number }], actionUrl: `/app/invoices/${invoice.id}`, clientActionUrl: `/portal/invoices/${invoice.id}`, actionLabel: "Open invoice", email: true },
      });
      return;
    }
    case "account.updated": {
      const a = event.data.object as Stripe.Account;
      await db.paymentAccount.updateMany({ where: { stripeAccountId: a.id }, data: { chargesEnabled: a.charges_enabled, payoutsEnabled: a.payouts_enabled, detailsSubmitted: a.details_submitted } });
      return;
    }
  }
}

/** Creates the Payment once (unique providerPaymentId) and recomputes the invoice under lock. */
export async function recordStripePayment(stripeAccountId: string, invoiceId: string, workspaceId: string, paymentIntentId: string, amountCents: number, currency: string, sessionId: string) {
  // The event must come from the connected account that owns this invoice's workspace.
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, workspaceId, workspace: { paymentAccount: { stripeAccountId } } } });
  if (!inv) throw new Error(`Invoice ${invoiceId} not found for account ${stripeAccountId}`);
  if (currency !== inv.currency) throw new Error(`Currency mismatch for invoice ${invoiceId}`);
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { providerPaymentId: paymentIntentId } });
    if (existing) return null; // duplicate delivery — already recorded
    await tx.payment.create({
      data: { workspaceId, invoiceId, clientId: inv.clientId, amountCents, currency, provider: "stripe", providerPaymentId: paymentIntentId, method: "CARD", status: "SUCCEEDED", paidAt: new Date(), metadata: { checkoutSessionId: sessionId } },
    });
    return recomputeInvoice(tx, invoiceId);
  });
  if (result) await afterPayment(workspaceId, invoiceId, amountCents, null, "stripe");
}
