import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, integrations } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Two interchangeable backends: S3-compatible storage (when S3_* is set) or a private Vercel Blob
 * store (BLOB_READ_WRITE_TOKEN). Either way files are private and only reachable through
 * /api/files/[id] after an authorization check.
 */
const onBlob = () => !integrations.s3() && integrations.blob();

let client: S3Client | null = null;
function s3() {
  if (!integrations.s3()) throw new AppError("File storage is not configured. Add S3-compatible storage credentials to enable uploads.", "CONFIG");
  client ??= new S3Client({
    region: env.s3.region,
    endpoint: env.s3.endpoint || undefined,
    forcePathStyle: Boolean(env.s3.endpoint),
    credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
  });
  return client;
}

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const ALLOWED: Record<string, string[]> = {
  DOCUMENT: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "application/rtf", "application/vnd.oasis.opendocument.text"],
  SPREADSHEET: ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/vnd.oasis.opendocument.spreadsheet"],
  PRESENTATION: ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.oasis.opendocument.presentation"],
  IMAGE: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/heic"],
  VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
  ARCHIVE: ["application/zip", "application/x-zip-compressed", "application/x-7z-compressed", "application/x-rar-compressed", "application/gzip"],
  DESIGN: ["application/postscript", "application/illustrator", "image/vnd.adobe.photoshop", "application/x-figma"],
};
// SVG and HTML are intentionally NOT allowed: they can carry scripts (stored XSS).
const ALL_ALLOWED = new Set(Object.values(ALLOWED).flat());

export function validateUpload(mimeType: string, size: number) {
  if (!ALL_ALLOWED.has(mimeType)) throw new AppError("This file type is not supported.", "INVALID");
  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new AppError(["Files must be smaller than {n} MB.", { n: MAX_UPLOAD_BYTES / 1024 / 1024 }], "INVALID");
}

export function kindOf(mimeType: string): "PDF" | "IMAGE" | "VIDEO" | "DOCUMENT" | "SPREADSHEET" | "PRESENTATION" | "ARCHIVE" | "OTHER" {
  if (mimeType === "application/pdf") return "PDF";
  for (const [k, list] of Object.entries(ALLOWED)) if (list.includes(mimeType)) return (k === "DESIGN" ? "OTHER" : k) as never;
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return "OTHER";
}

/** Where the browser sends the bytes: a presigned S3 URL, or a scoped Vercel Blob client token. */
export type UploadTarget = { url: string } | { blob: { pathname: string; token: string } };

export async function presignUpload(key: string, mimeType: string, size: number): Promise<UploadTarget> {
  if (onBlob()) {
    const { generateClientTokenFromReadWriteToken } = await import("@vercel/blob/client");
    // The token only allows this exact pathname, this content type and at most the declared size.
    const token = await generateClientTokenFromReadWriteToken({ pathname: key, allowedContentTypes: [mimeType], maximumSizeInBytes: size, validUntil: Date.now() + 15 * 60_000 });
    return { blob: { pathname: key, token } };
  }
  if (!integrations.s3()) throw new AppError("File storage is not configured. Add S3-compatible storage credentials to enable uploads.", "CONFIG");
  return { url: await getSignedUrl(s3(), new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: mimeType, ContentLength: size }), { expiresIn: 600 }) };
}

/** Serves a stored file: redirect to a short-lived S3 URL, or stream a private Blob through us. */
export async function downloadResponse(key: string, filename: string, mimeType: string, inline = true): Promise<Response> {
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  if (onBlob()) {
    const { get } = await import("@vercel/blob");
    const r = await get(key, { access: "private" });
    if (!r || r.statusCode !== 200) return new Response("Not found", { status: 404 });
    return new Response(r.stream, {
      headers: {
        "Content-Type": r.blob.contentType || mimeType,
        "Content-Length": String(r.blob.size),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  }
  const url = await presignDownload(key, filename, inline);
  return Response.redirect(url, 302);
}

/** Short-lived signed URL — private files never get permanent public URLs. */
export async function presignDownload(key: string, filename: string, inline = true) {
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.s3.bucket, Key: key, ResponseContentDisposition: disposition }), { expiresIn: 300 });
}

export async function headObject(key: string) {
  if (onBlob()) {
    const { head } = await import("@vercel/blob");
    const b = await head(key);
    return { size: b.size, contentType: b.contentType };
  }
  const r = await s3().send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
  return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? "" };
}

export async function deleteObject(key: string) {
  if (onBlob()) return (await import("@vercel/blob")).del(key);
  await s3().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (onBlob()) {
    await (await import("@vercel/blob")).put(key, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  await s3().send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: contentType }));
}
