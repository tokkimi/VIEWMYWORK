import crypto from "crypto";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) return NextResponse.json({ message: "Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI to .env.local." }, { status: 503 });
  const ownerId = request.headers.get("x-viewmywork-user-id");
  if (!ownerId) return NextResponse.json({ message: "Sign in is required before connecting Google Drive." }, { status: 401 });
  const state = `${ownerId}.${crypto.randomBytes(24).toString("hex")}`;
  const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI, response_type: "code", access_type: "offline", prompt: "consent", scope: "https://www.googleapis.com/auth/drive.readonly", state });
  const response = NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  response.cookies.set("google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}
