import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

// Notifications are always scoped to the session user — never to a user id from the request.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 10)));
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, title: true, message: true, actionUrl: true, readAt: true, createdAt: true, category: true } }),
  ]);
  return NextResponse.json({ unread, items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = z.object({ all: z.boolean().optional(), ids: z.array(z.string().uuid()).max(200).optional() }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const where = body.data.all ? { userId: user.id, readAt: null } : { userId: user.id, id: { in: body.data.ids ?? [] } };
  await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
