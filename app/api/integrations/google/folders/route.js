import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/auth";
import { googleFetch } from "../../../../../lib/google-drive";

export async function GET(request) {
  const { ownerId, error } = requireUser(request);
  if (error) return error;
  try {
    const data = await googleFetch(ownerId, "files?q=mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id%2Cname%2CmodifiedTime)&orderBy=modifiedTime%20desc&pageSize=100");
    return NextResponse.json({ folders: data.files });
  } catch { return NextResponse.json({ message: "Unable to load Google Drive folders." }, { status: 502 }); }
}
