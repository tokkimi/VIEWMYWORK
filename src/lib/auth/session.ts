import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "vmw_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = randomToken(32);
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Resolves the logged-in user from the HTTP-only session cookie. Cached per request. */
export const getSessionUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;
  // Touch at most every 10 minutes to avoid a write per request.
  if (Date.now() - session.lastUsedAt.getTime() > 10 * 60_000) {
    await db.$transaction([
      db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }),
      db.user.update({ where: { id: session.userId }, data: { lastActiveAt: new Date() } }),
    ]);
  }
  return session.user;
});
