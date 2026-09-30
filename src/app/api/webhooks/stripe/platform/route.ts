import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { claimWebhookEvent } from "@/server/services/payments";
import { handlePlatformEvent } from "@/server/services/subscriptions";

// Platform webhook: SaaS subscription billing only (Domain A).
export async function POST(req: NextRequest) {
  if (!env.stripe.platformWebhookSecret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig ?? "", env.stripe.platformWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.account) return NextResponse.json({ received: true, ignored: "connect event" });
  if (!(await claimWebhookEvent(event.id, "stripe_platform", event.type))) return NextResponse.json({ received: true, duplicate: true });
  try {
    await handlePlatformEvent(event);
  } catch (err) {
    await db.webhookEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error("[stripe:platform]", event.type, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
