import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/auth/context";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { createInvoiceCheckout } from "@/server/services/payments";

// Form POST → server creates the Checkout Session from DB values → 303 to Stripe.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(env.appUrl).host && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  if (!isUuid(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const from = (await req.formData().catch(() => null))?.get("from") === "portal" ? "portal" : "public";
  try {
    const url = await createInvoiceCheckout(token, from);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    const msg = e instanceof AppError ? e.message : "Payment could not be started.";
    if (!(e instanceof AppError)) console.error("[pay]", e);
    return new NextResponse(`<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#08090b;color:#f5f7fa;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:420px;text-align:center;padding:24px"><h1 style="font-size:18px">Payment unavailable</h1><p style="color:#8d939e;font-size:14px">${msg.replace(/[<>&]/g, "")}</p><a style="color:#4d7cfe" href="javascript:history.back()">Go back</a></div></body>`, { status: 400, headers: { "Content-Type": "text/html" } });
  }
}
