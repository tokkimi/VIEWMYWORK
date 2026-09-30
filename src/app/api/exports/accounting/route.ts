import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceCtx, can } from "@/lib/auth/context";
import { hasFeature } from "@/lib/plans";
import { accountingData, periodRange, toCsv, toPdf, type Period } from "@/server/services/exports";

export async function GET(req: NextRequest) {
  const ctx = await getWorkspaceCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx, "finance", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await hasFeature(ctx.workspace.id, "accounting_exports"))) return NextResponse.json({ error: "Accounting exports are not included in your plan." }, { status: 402 });
  const sp = req.nextUrl.searchParams;
  const period = (["this_month", "last_month", "quarter", "year", "custom"].includes(sp.get("period") ?? "") ? sp.get("period") : "this_month") as Period;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  if (period === "custom" && (!from || !to || isNaN(Date.parse(from)) || isNaN(Date.parse(to)))) return NextResponse.json({ error: "Invalid custom range" }, { status: 400 });
  const { start, end } = periodRange(period, from, to);
  const data = await accountingData(ctx.workspace.id, start, end);
  const label = `${start.toISOString().slice(0, 10)}_${new Date(end.getTime() - 86400_000).toISOString().slice(0, 10)}`;
  if (sp.get("format") === "pdf") {
    const pdf = await toPdf(data, `Accounting export ${label.replace("_", " → ")}`, ctx.workspace.name);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="accounting_${label}.pdf"`, "Cache-Control": "no-store" } });
  }
  return new Response(toCsv(data), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="accounting_${label}.csv"`, "Cache-Control": "no-store" } });
}
