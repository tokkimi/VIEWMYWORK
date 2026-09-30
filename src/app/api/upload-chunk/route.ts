import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { DB_CHUNK_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Built-in storage: receives one chunk of a pending upload. Only the user who started the upload
 * can send chunks, only for its declared size; the upload is verified again when completed.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const idx = Number(req.nextUrl.searchParams.get("idx"));
  if (!key || !Number.isInteger(idx) || idx < 0) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const file = await db.file.findFirst({ where: { storageKey: key, status: "PENDING", uploadedById: user.id }, select: { sizeBytes: true } });
  if (!file) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  const parts = Math.max(1, Math.ceil(Number(file.sizeBytes) / DB_CHUNK_BYTES));
  if (idx >= parts) return NextResponse.json({ error: "Bad chunk" }, { status: 400 });
  const data = new Uint8Array(await req.arrayBuffer());
  if (!data.length || data.length > DB_CHUNK_BYTES) return NextResponse.json({ error: "Bad chunk size" }, { status: 413 });
  await db.fileChunk.upsert({ where: { key_idx: { key, idx } }, create: { key, idx, data }, update: { data } });
  return NextResponse.json({ ok: true });
}
