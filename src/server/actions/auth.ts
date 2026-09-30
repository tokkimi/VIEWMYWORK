"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { zEmail, formToObject } from "@/lib/validation";
import { integrations, env } from "@/lib/env";
import { consumeAuthToken, issueAuthToken, sendVerificationEmail } from "@/server/auth-tokens";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { adoptUserLocale, getLocale, setLocaleCookie } from "@/lib/i18n/server";
import { normalizeLocale } from "@/lib/i18n/core";

const password = z.string().min(10, "Use at least 10 characters.").max(200);

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signupAction(fd: FormData) {
  return runAction(async () => {
    await rateLimit("signup", 10, 3600);
    const input = z.object({ name: z.string().trim().min(1, "Enter your name.").max(100), email: zEmail, password, next: z.string().optional() }).parse(formToObject(fd));
    const exists = await db.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppError("An account already exists for this email. Try signing in.", "CONFLICT");
    // Without an email provider we cannot deliver verification links; accounts are then verified on creation.
    // Same for a client arriving through a valid portal access link sent personally by their provider.
    const inviteToken = safeNext(input.next)?.match(/^\/invite\/([A-Za-z0-9_-]{20,})$/)?.[1];
    const viaLink = inviteToken ? await db.invitation.findFirst({ where: { tokenHash: sha256(inviteToken), kind: "CLIENT", email: "", acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }) : null;
    const autoVerify = !integrations.email() || Boolean(viaLink);
    const user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        emailVerifiedAt: autoVerify ? new Date() : null,
        locale: await getLocale(),
        platformRole: process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() === input.email ? "SUPER_ADMIN" : "USER",
      },
    });
    await createSession(user.id);
    const next = safeNext(input.next);
    if (!autoVerify) {
      await sendVerificationEmail(user, next ?? undefined);
      return { redirect: "/verify-email" };
    }
    return { redirect: next ?? "/onboarding" };
  });
}

export async function loginAction(fd: FormData) {
  return runAction(async () => {
    const input = z.object({ email: zEmail, password: z.string().min(1, "Enter your password."), next: z.string().optional() }).parse(formToObject(fd));
    await rateLimit("login", 10, 900, input.email);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const ok = await verifyPassword(input.password, user?.passwordHash);
    if (!user || !ok) throw new AppError("Incorrect email or password.", "INVALID");
    if (user.status !== "ACTIVE") throw new AppError("This account is suspended. Contact support.", "FORBIDDEN");
    await createSession(user.id);
    const locale = await adoptUserLocale(user.locale);
    if (locale !== user.locale) await db.user.update({ where: { id: user.id }, data: { locale } });
    if (!user.emailVerifiedAt) return { redirect: "/verify-email" };
    const next = safeNext(input.next);
    if (next) return { redirect: next };
    const [member, portal] = await Promise.all([
      db.workspaceMember.findFirst({ where: { userId: user.id, status: "ACTIVE" } }),
      db.clientPortalAccess.findFirst({ where: { userId: user.id, revokedAt: null } }),
    ]);
    return { redirect: member ? "/app" : portal ? "/portal" : "/onboarding" };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function resendVerificationAction() {
  return runAction(async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in again.", "FORBIDDEN");
    if (user.emailVerifiedAt) return { redirect: "/onboarding" };
    await rateLimit("verify-resend", 5, 3600, user.id);
    const r = await sendVerificationEmail(user);
    if (r.status !== "SENT") throw new AppError("We couldn't send the email right now. Please try again later.", "CONFIG");
    return null;
  }, "Verification email sent.");
}

export async function forgotPasswordAction(fd: FormData) {
  return runAction(async () => {
    const { email } = z.object({ email: zEmail }).parse(formToObject(fd));
    await rateLimit("forgot", 5, 3600, email);
    const user = await db.user.findUnique({ where: { email } });
    if (user && user.status === "ACTIVE") {
      const token = await issueAuthToken(user.id, "PASSWORD_RESET", 60);
      const t = emailTemplates.passwordReset(`${env.appUrl}/reset-password?token=${token}`, normalizeLocale(user.locale));
      await sendEmail({ to: user.email, subject: t.subject, html: t.html, template: "password_reset" });
    }
    // Same response whether or not the account exists (prevents account enumeration).
    return null;
  }, "If an account exists for this email, a reset link is on its way.");
}

export async function resetPasswordAction(fd: FormData) {
  return runAction(async () => {
    await rateLimit("reset", 10, 3600);
    const input = z.object({ token: z.string().min(10), password }).parse(formToObject(fd));
    const userId = await consumeAuthToken(input.token, "PASSWORD_RESET");
    if (!userId) throw new AppError("This reset link is invalid or has expired.", "INVALID");
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.password), emailVerifiedAt: new Date() } }),
      db.session.deleteMany({ where: { userId } }), // sign out everywhere
    ]);
    await db.auditLog.create({ data: { actorId: userId, scope: "PLATFORM", action: "PASSWORD_RESET", targetType: "USER", targetId: userId } });
    await createSession(userId);
    return { redirect: "/app" };
  }, "Password updated.");
}

export async function updateProfileAction(fd: FormData) {
  return runAction(async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in again.", "FORBIDDEN");
    const input = z.object({ name: z.string().trim().min(1).max(100), timezone: z.string().trim().max(64), locale: z.enum(["en", "fr"]) }).parse(formToObject(fd));
    await db.user.update({ where: { id: user.id }, data: input });
    await setLocaleCookie(input.locale);
    return null;
  }, "Profile saved.");
}

export async function changePasswordAction(fd: FormData) {
  return runAction(async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("Please sign in again.", "FORBIDDEN");
    await rateLimit("change-password", 10, 3600, user.id);
    const input = z.object({ current: z.string().min(1, "Enter your current password."), password }).parse(formToObject(fd));
    if (!(await verifyPassword(input.current, user.passwordHash))) throw new AppError("Current password is incorrect.", "INVALID");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
    await db.auditLog.create({ data: { actorId: user.id, actorEmail: user.email, scope: "PLATFORM", action: "PASSWORD_CHANGED", targetType: "USER", targetId: user.id } });
    return null;
  }, "Password changed.");
}

export async function consumeVerification(token: string) {
  const userId = await consumeAuthToken(token, "EMAIL_VERIFICATION");
  if (!userId) return false;
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return true;
}
