import { NextResponse } from "next/server";

// Replace this adapter with the session lookup from your chosen auth provider.
// Keeping it isolated makes every integration route deny anonymous access by default.
export function requireUser(request) {
  const ownerId = request.headers.get("x-viewmywork-user-id");
  if (!ownerId) return { error: NextResponse.json({ message: "Sign in is required." }, { status: 401 }) };
  return { ownerId };
}
