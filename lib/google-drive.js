import { database } from "./db";
import { decrypt } from "./crypto";

export async function accessTokenFor(ownerId) {
  const sql = database();
  const [integration] = await sql`select encrypted_refresh_token from integrations where owner_id = ${ownerId} and provider = 'google_drive'`;
  if (!integration) throw new Error("Google Drive is not connected");
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: decrypt(integration.encrypted_refresh_token), grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  if (!response.ok) throw new Error("Google token refresh failed");
  return (await response.json()).access_token;
}

export async function googleFetch(ownerId, path) {
  const accessToken = await accessTokenFor(ownerId);
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Google Drive request failed");
  return response.json();
}
