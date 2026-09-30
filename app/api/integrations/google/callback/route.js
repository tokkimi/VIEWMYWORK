import { NextResponse } from "next/server";
import { database } from "../../../../../lib/db";
import { encrypt } from "../../../../../lib/crypto";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const expected = request.cookies.get("google_oauth_state")?.value;
  if (!expected || expected !== searchParams.get("state")) return NextResponse.redirect(new URL("/?google=invalid_state", request.url));
  if (searchParams.get("error")) return NextResponse.redirect(new URL("/?google=cancelled", request.url));
  const ownerId = expected.split(".")[0];
  const tokenRequest = new URLSearchParams({ code: searchParams.get("code"), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code" });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenRequest });
  if (!tokenResponse.ok) return NextResponse.redirect(new URL("/?google=failed", request.url));
  const token = await tokenResponse.json();
  if (!token.refresh_token) return NextResponse.redirect(new URL("/?google=missing_refresh_token", request.url));
  const sql = database();
  await sql`insert into integrations (owner_id, provider, encrypted_refresh_token) values (${ownerId}, 'google_drive', ${encrypt(token.refresh_token)}) on conflict (owner_id, provider) do update set encrypted_refresh_token = excluded.encrypted_refresh_token`;
  return NextResponse.redirect(new URL("/?google=connected", request.url));
}
