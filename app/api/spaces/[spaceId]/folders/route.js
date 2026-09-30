import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/auth";
import { database } from "../../../../../lib/db";

export async function POST(request, { params }) {
  const { ownerId, error } = requireUser(request);
  if (error) return error;
  const { spaceId } = await params;
  const { providerFolderId, label } = await request.json();
  if (!providerFolderId || !label) return NextResponse.json({ message: "Folder ID and label are required." }, { status: 400 });
  const sql = database();
  const [space] = await sql`select id from client_spaces where id = ${spaceId} and owner_id = ${ownerId}`;
  const [integration] = await sql`select id from integrations where owner_id = ${ownerId} and provider = 'google_drive'`;
  if (!space || !integration) return NextResponse.json({ message: "Client space or Google Drive connection not found." }, { status: 404 });
  await sql`insert into shared_folders (client_space_id, integration_id, provider_folder_id, label) values (${spaceId}, ${integration.id}, ${providerFolderId}, ${label}) on conflict (client_space_id, provider_folder_id) do nothing`;
  return NextResponse.json({ message: "Folder is now visible inside this client space." }, { status: 201 });
}
