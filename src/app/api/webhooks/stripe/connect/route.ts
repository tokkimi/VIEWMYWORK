import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { claimWebhookEvent, handleConnectEvent } from "@/server/services/payments";

// Connect webhook: events from professionals' connected accounts (client invoice payments).
export async function POST(req: NextRequest) {
  if (!env.stripe.connectWebhookSecret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig ?? "", env.stripe.connectWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!(await claimWebhookEvent(event.id, "stripe_connect", event.type))) return NextResponse.json({ received: true, duplicate: true });
  try {
    await handleConnectEvent(event);
  } catch (err) {
    // Release the claim so Stripe's retry can reprocess the event.
    await db.webhookEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error("[stripe:connect]", event.type, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
