import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/auth/context";
import { downloadResponse } from "@/lib/storage";
import { memberCanReadFile, clientCanReadFile } from "@/server/services/files";

/**
 * Authorised file access: checks membership/permissions or client visibility, then
 * redirects to a 5-minute signed URL. Storage objects are never publicly readable.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = await db.file.findFirst({ where: { id, deletedAt: null, status: "READY" } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = (await memberCanReadFile(user.id, file)) || (await clientCanReadFile(user.id, file));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (file.source === "GOOGLE_DRIVE") {
    if (!file.externalUrl || file.externalMissing) return NextResponse.json({ error: "This Google Drive file is no longer available." }, { status: 410 });
    return NextResponse.redirect(file.externalUrl, 302);
  }
  try {
    return await downloadResponse(file.storageKey!, file.name, file.mimeType, req.nextUrl.searchParams.get("download") !== "1");
  } catch {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}
