"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { runAction, AppError } from "@/lib/errors";
import { requireWorkspace, requirePerm, requireProjectPerm } from "@/lib/auth/context";
import { hasLevel } from "@/lib/auth/permissions";
import { formToObject, zId, zBool } from "@/lib/validation";
import { decrypt } from "@/lib/crypto";
import { driveMetadata, parseDriveId } from "@/server/services/google-drive";
import { emit } from "@/lib/events";

export async function disconnectDriveAction() {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const integ = await db.integration.findUnique({ where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider: "GOOGLE_DRIVE" } } });
    if (!integ) return null;
    // Best-effort revoke at Google; local state is cleared regardless.
    const tok = integ.refreshTokenEnc ?? integ.accessTokenEnc;
    if (tok) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(tok))}`, { method: "POST" }).catch(() => {});
    await db.integration.update({ where: { id: integ.id }, data: { status: "DISCONNECTED", accessTokenEnc: null, refreshTokenEnc: null, expiresAt: null } });
    await db.auditLog.create({ data: { actorId: ctx.user.id, actorEmail: ctx.user.email, scope: "WORKSPACE", workspaceId: ctx.workspace.id, action: "INTEGRATION_DISCONNECTED", targetType: "INTEGRATION", targetId: "GOOGLE_DRIVE" } });
    return null;
  }, "Google Drive disconnected. Linked files remain listed.");
}

export async function setDriveFolderAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    requirePerm(ctx, "settings", "manage");
    const { folder } = z.object({ folder: z.string().trim().max(500) }).parse(formToObject(fd));
    const id = folder ? parseDriveId(folder) : null;
    let name: string | null = null;
    if (id) {
      const meta = await driveMetadata(ctx.workspace.id, id);
      if (!meta) throw new AppError("Folder not found in the connected Google account.");
      if (meta.mimeType !== "application/vnd.google-apps.folder") throw new AppError("That link is a file, not a folder.");
      name = meta.name;
    }
    await db.integration.update({ where: { workspaceId_provider: { workspaceId: ctx.workspace.id, provider: "GOOGLE_DRIVE" } }, data: { config: id ? { defaultFolderId: id, defaultFolderName: name } : {} } });
    return null;
  }, "Default folder saved.");
}

/** Links a Drive file by reference (no copy, no storage quota). */
export async function linkDriveFileAction(fd: FormData) {
  return runAction(async () => {
    const ctx = await requireWorkspace();
    const i = z.object({ projectId: zId, url: z.string().trim().min(5).max(1000), clientVisible: zBool }).parse(formToObject(fd));
    const { project, perms } = await requireProjectPerm(ctx, i.projectId, "files", "upload");
    if (!hasLevel(perms, "files", "upload")) throw new AppError("You can't add files to this project.", "FORBIDDEN");
    const id = parseDriveId(i.url);
    const meta = await driveMetadata(ctx.workspace.id, id);
    if (!meta) throw new AppError("File not found — it may have been deleted or isn't shared with the connected account.");
    const existing = await db.file.findFirst({ where: { workspaceId: ctx.workspace.id, projectId: i.projectId, source: "GOOGLE_DRIVE", externalId: meta.id, deletedAt: null } });
    if (existing) throw new AppError("This Drive file is already linked to the project.", "CONFLICT");
    const f = await db.file.create({ data: { workspaceId: ctx.workspace.id, projectId: project.id, clientId: project.clientId, source: "GOOGLE_DRIVE", name: meta.name, mimeType: meta.mimeType, sizeBytes: 0n, status: "READY", externalId: meta.id, externalUrl: meta.webViewLink, visibility: i.clientVisible ? "CLIENT_VISIBLE" : "INTERNAL", category: meta.mimeType.includes("folder") ? "OTHER" : "DOCUMENT", uploadedById: ctx.user.id } });
    await emit({ workspaceId: ctx.workspace.id, type: "FILE_UPLOADED", actor: { id: ctx.user.id, name: ctx.user.name }, projectId: project.id, clientId: project.clientId, entityType: "FILE", entityId: f.id, summary: ["Linked Google Drive file {name}", { name: meta.name }], clientVisible: i.clientVisible });
    return null;
  }, "Drive file linked.");
}
