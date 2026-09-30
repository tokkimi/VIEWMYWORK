import type { AuthTokenType } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";

export async function issueAuthToken(userId: string, type: AuthTokenType, ttlMinutes: number) {
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomToken(32);
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return token;
}

export async function consumeAuthToken(token: string, type: AuthTokenType) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const updated = await db.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return updated.count === 1 ? row.userId : null;
}

export async function sendVerificationEmail(user: { id: string; email: string }, next?: string) {
  const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24 * 60);
  const link = `${env.appUrl}/api/auth/verify?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  const t = emailTemplates.emailVerification(link);
  return sendEmail({ to: user.email, subject: t.subject, html: t.html, template: "email_verification" });
}
