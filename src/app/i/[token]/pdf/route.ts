import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/auth/context";
import { invoicePdfResponse } from "@/server/services/invoice-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUuid(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inv = await db.invoice.findUnique({ where: { publicToken: token }, select: { id: true, status: true } });
  if (!inv || inv.status === "DRAFT") return NextResponse.json({ error: "Not found" }, { status: 404 });
  return invoicePdfResponse(inv.id);
}
