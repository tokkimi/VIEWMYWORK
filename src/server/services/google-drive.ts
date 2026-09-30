import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decrypt, encrypt } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { notifyWorkspaceAdmins } from "@/lib/events";

export const DRIVE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.metadata.readonly"];
export const redirectUri = () => `${env.appUrl}/api/integrations/google/callback`;

export async function exchangeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.google.clientId, client_secret: env.google.clientSecret, redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new AppError("Google rejected the connection. Please try again.");
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
}

async function markDisconnected(workspaceId: string, reason: string) {
  await db.integration.update({ where: { workspaceId_provider: { workspaceId, provider: "GOOGLE_DRIVE" } }, data: { status: "DISCONNECTED", lastError: reason, accessTokenEnc: null } });
  await notifyWorkspaceAdmins(workspaceId, "INTEGRATION_DISCONNECTED", "Google Drive disconnected", `Access to Google Drive was lost (${reason}). Linked files stay listed but can't be refreshed until you reconnect.`, "/app/settings/integrations");
}

/** Returns a valid access token, refreshing it when expired. Revoked access disconnects gracefully. */
async function accessToken(workspaceId: string) {
  const integ = await db.integration.findUnique({ where: { workspaceId_provider: { workspaceId, provider: "GOOGLE_DRIVE" } } });
  if (!integ || integ.status !== "CONNECTED") throw new AppError("Google Drive isn't connected.", "CONFIG");
  if (integ.accessTokenEnc && integ.expiresAt && integ.expiresAt.getTime() > Date.now() + 60_000) return decrypt(integ.accessTokenEnc);
  if (!integ.refreshTokenEnc) {
    await markDisconnected(workspaceId, "missing refresh token");
    throw new AppError("Google Drive access expired. Reconnect it in Settings → Integrations.", "CONFIG");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.google.clientId, client_secret: env.google.clientSecret, refresh_token: decrypt(integ.refreshTokenEnc), grant_type: "refresh_token" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "invalid_grant") {
      await markDisconnected(workspaceId, "access revoked");
      throw new AppError("Google Drive access was revoked. Reconnect it in Settings → Integrations.", "CONFIG");
    }
    throw new AppError("Google Drive is temporarily unavailable.", "CONFIG");
  }
  const t = (await res.json()) as { access_token: string; expires_in: number };
  await db.integration.update({ where: { id: integ.id }, data: { accessTokenEnc: encrypt(t.access_token), expiresAt: new Date(Date.now() + t.expires_in * 1000), lastError: null } });
  return t.access_token;
}

export function parseDriveId(input: string) {
  const s = input.trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/) ?? s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ?? s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  throw new AppError("That doesn't look like a Google Drive link.");
}

export type DriveMeta = { id: string; name: string; mimeType: string; webViewLink: string; trashed?: boolean };

export async function driveMetadata(workspaceId: string, fileId: string): Promise<DriveMeta | null> {
  const token = await accessToken(workspaceId);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink,trashed&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  if (res.status === 401) {
    await markDisconnected(workspaceId, "token rejected");
    throw new AppError("Google Drive access expired. Reconnect it in Settings → Integrations.", "CONFIG");
  }
  if (res.status === 403) throw new AppError("The connected Google account doesn't have access to this file.", "FORBIDDEN");
  if (!res.ok) throw new AppError("Google Drive is temporarily unavailable.", "CONFIG");
  const meta = (await res.json()) as DriveMeta;
  return meta.trashed ? null : meta;
}
