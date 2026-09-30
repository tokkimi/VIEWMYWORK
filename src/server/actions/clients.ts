"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError, notFound } from "@/lib/errors";
import { requireWorkspace, requirePerm, isUuid, type WorkspaceCtx } from "@/lib/auth/context";
import { formToObject, zEmail, zOptEmail, zOptStr, zCurrency, zId } from "@/lib/validation";
import { assertWithinLimit, requireActiveSubscription } from "@/lib/plans";
import { emit } from "@/lib/events";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { normalizeLocale, translate } from "@/lib/i18n/core";
import { rateLimit } from "@/lib/rate-limit";

const clientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().max(80).default(""),
  company: zOptStr(120),
  email: zEmail,
  phone: zOptStr(40),
  billingEmail: zOptEmail,
  billingAddress: zOptStr(500),
  country: zOptStr(60),
  currency: zCurrency.default("EUR"),
  timezone: zOptStr(64),
  preferredLanguage: z.string().trim().max(10).default("en"),
  vatNumber: zOptStr(40),
  companyRegistration: zOptStr(60),
  notes: zOptStr(5000),
  tags: z.preprocess((v) => (typeof v === "string" ? v.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12) : []), z.array(z.string().max(30))),
});

async function getClient(ctx: WorkspaceCtx, id: string) {
  if (!isUuid(id)) throw notFound("Client not found.");
  const c = await db.client.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
  if (!c) throw notFound("Client not found.");
  return c;
}

export async function createClientAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "clients", "edit");
    await assertWithinLimit(ctx.workspace.id, "clients");
    const input = clientSchema.parse(formToObject(fd));
    const client = await db.client.create({ data: { ...input, workspaceId: ctx.workspace.id } });
    await emit({ workspaceId: ctx.workspace.id, type: "CLIENT_CREATED", actor: { id: ctx.user.id, name: ctx.user.name }, clientId: client.id, entityType: "CLIENT", entityId: client.id, summary: ["Client {name} created", { name: `${client.firstName} ${client.lastName}${client.company ? ` (${client.company})` : ""}` }] });
    return { id: client.id };
  }, "Client created.");
}

export async function updateClientAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "clients", "edit");
    const id = zId.parse(fd.get("id"));
    await getClient(ctx, id);
    const input = clientSchema.parse(formToObject(fd));
    await db.client.update({ where: { id }, data: input });
    return { id };
  }, "Client saved.");
}

export async function archiveClientAction(id: string, archive: boolean) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "clients", "edit");
    await getClient(ctx, id);
    await db.client.update({ where: { id }, data: { archivedAt: archive ? new Date() : null } });
    return null;
  }, archive ? "Client archived." : "Client restored.");
}

export async function addClientContactAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "clients", "edit");
    const i = z.object({ clientId: zId, name: z.string().trim().min(1).max(120), email: zOptEmail, phone: zOptStr(40), role: zOptStr(80) }).parse(formToObject(fd));
    await getClient(ctx, i.clientId);
    await db.clientContact.create({ data: i });
    return null;
  }, "Contact added.");
}

export async function removeClientContactAction(id: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "clients", "edit");
    const c = await db.clientContact.findFirst({ where: { id, client: { workspaceId: ctx.workspace.id } } });
    if (!c) throw notFound();
    await db.clientContact.delete({ where: { id } });
    return null;
  }, "Contact removed.");
}

/** Invites the client (or one of its contacts) to the portal. Creates a single-use invitation token. */
export async function inviteClientToPortalAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "clients", "edit");
    await requireActiveSubscription(ctx.workspace.id);
    await rateLimit("invite-client", 30, 3600, ctx.workspace.id);
    const i = z.object({ clientId: zId, email: zEmail, message: zOptStr(2000), projectId: z.string().optional() }).parse(formToObject(fd));
    const client = await getClient(ctx, i.clientId);
    const token = randomToken(32);
    await db.invitation.updateMany({ where: { workspaceId: ctx.workspace.id, clientId: client.id, email: i.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await db.invitation.create({ data: { workspaceId: ctx.workspace.id, kind: "CLIENT", email: i.email, clientId: client.id, tokenHash: sha256(token), invitedById: ctx.user.id, expiresAt: new Date(Date.now() + 14 * 86400_000) } });
    const project = i.projectId && isUuid(i.projectId) ? await db.project.findFirst({ where: { id: i.projectId, workspaceId: ctx.workspace.id } }) : null;
    const settings = await db.workspaceSetting.findUnique({ where: { workspaceId: ctx.workspace.id } });
    const t = emailTemplates.clientInvitation({ brand: { name: ctx.workspace.name, logoUrl: settings?.portalLogoUrl ?? ctx.workspace.logoUrl }, clientName: client.firstName, projectName: project?.name, message: i.message, link: `${env.appUrl}/invite/${token}` }, normalizeLocale(client.preferredLanguage));
    const r = await sendEmail({ to: i.email, subject: t.subject, html: t.html, template: "client_invitation", workspaceId: ctx.workspace.id, entityType: "CLIENT", entityId: client.id, fromName: ctx.workspace.name, replyTo: ctx.user.email });
    await emit({ workspaceId: ctx.workspace.id, type: "CLIENT_INVITED", actor: { id: ctx.user.id, name: ctx.user.name }, clientId: client.id, entityType: "CLIENT", entityId: client.id, summary: ["Portal invitation sent to {email}", { email: i.email }] });
    // Link is returned so the professional can share it manually when email isn't configured.
    return { link: `${env.appUrl}/invite/${token}`, emailStatus: r.status };
  });
}

export async function revokePortalAccessAction(accessId: string) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "clients", "edit");
    const a = await db.clientPortalAccess.findFirst({ where: { id: accessId, workspaceId: ctx.workspace.id } });
    if (!a) throw notFound();
    await db.clientPortalAccess.update({ where: { id: accessId }, data: { revokedAt: new Date() } });
    await db.auditLog.create({ data: { actorId: ctx.user.id, actorEmail: ctx.user.email, scope: "WORKSPACE", workspaceId: ctx.workspace.id, action: "PORTAL_ACCESS_REVOKED", targetType: "CLIENT", targetId: a.clientId } });
    return null;
  }, "Portal access revoked.");
}

export async function sendClientEmailAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "messages", "send");
    await rateLimit("client-email", 50, 3600, ctx.workspace.id);
    const i = z.object({ clientId: zId, subject: z.string().trim().min(1, "Subject is required.").max(200), message: z.string().trim().min(1, "Message is required.").max(10000), sendCopy: z.string().optional() }).parse(formToObject(fd));
    const client = await getClient(ctx, i.clientId);
    const settings = await db.workspaceSetting.findUnique({ where: { workspaceId: ctx.workspace.id } });
    const locale = normalizeLocale(client.preferredLanguage);
    const t = emailTemplates.directMessage({ brand: { name: ctx.workspace.name, logoUrl: settings?.portalLogoUrl ?? ctx.workspace.logoUrl }, subject: i.subject, message: i.message, link: `${env.appUrl}/portal`, linkLabel: translate(locale, "Open my portal") }, locale);
    const r = await sendEmail({ to: client.email, bcc: i.sendCopy ? [ctx.user.email] : undefined, subject: t.subject, html: t.html, template: "direct_message", workspaceId: ctx.workspace.id, entityType: "CLIENT", entityId: client.id, fromName: ctx.workspace.name, replyTo: ctx.user.email });
    if (r.status === "NOT_CONFIGURED") throw new AppError("Email delivery isn't configured on this platform yet. The message was not sent.", "CONFIG");
    if (r.status === "FAILED") throw new AppError(["Email could not be delivered: {error}", { error: r.error ?? "unknown error" }]);
    return null;
  }, "Email sent.");
}
