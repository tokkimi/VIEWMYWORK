import { db } from "@/lib/db";
import { isUuid } from "@/lib/auth/context";

export const runtime = "nodejs";

/** Public, cacheable workspace logo (used in the app, the client portal, emails and invoice PDFs). */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string; kind: string }> }) {
  const { workspaceId, kind } = await params;
  if (!isUuid(workspaceId) || !["logo", "portalLogo", "invoiceLogo"].includes(kind)) return new Response("Not found", { status: 404 });
  const a = await db.workspaceAsset.findUnique({ where: { workspaceId_kind: { workspaceId, kind } }, select: { mime: true, data: true } });
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
