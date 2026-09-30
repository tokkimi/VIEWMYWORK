import { Resend } from "resend";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "../../../lib/auth";
import { database } from "../../../lib/db";

export async function POST(request) {
  const { ownerId, error } = requireUser(request);
  if (error) return error;
  const { email, room } = await request.json();
  if (!email || !room) return NextResponse.json({ message: "An email address and a client space are required." }, { status: 400 });
  const sql = database();
  const [space] = await sql`select id from client_spaces where owner_id = ${ownerId} and name = ${room}`;
  if (!space) return NextResponse.json({ message: "Client space not found." }, { status: 404 });
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await sql`insert into client_invites (client_space_id, email, token_hash, expires_at) values (${space.id}, ${email}, ${tokenHash}, now() + interval '7 days')`;
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return NextResponse.json({ message: `Invitation for ${email} is stored. Add Resend credentials to send it.` }, { status: 202 });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const inviteUrl = `${new URL(request.url).origin}/invite/${rawToken}`;
  await resend.emails.send({ from: process.env.EMAIL_FROM, to: email, subject: `You've been invited to ${room}`, html: `<p>You have been invited to view <strong>${room}</strong> on VIEWMYWORK.</p><p><a href="${inviteUrl}">Open your client space</a></p>` });
  return NextResponse.json({ message: `Invitation sent to ${email}.` });
}
