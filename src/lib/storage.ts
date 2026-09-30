import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, integrations } from "@/lib/env";
import { AppError } from "@/lib/errors";

let client: S3Client | null = null;
function s3() {
  if (!integrations.storage()) throw new AppError("File storage is not configured. Add S3-compatible storage credentials to enable uploads.", "CONFIG");
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
  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new AppError(`Files must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, "INVALID");
}

export function kindOf(mimeType: string): "PDF" | "IMAGE" | "VIDEO" | "DOCUMENT" | "SPREADSHEET" | "PRESENTATION" | "ARCHIVE" | "OTHER" {
  if (mimeType === "application/pdf") return "PDF";
  for (const [k, list] of Object.entries(ALLOWED)) if (list.includes(mimeType)) return (k === "DESIGN" ? "OTHER" : k) as never;
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return "OTHER";
}

export async function presignUpload(key: string, mimeType: string, size: number) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: mimeType, ContentLength: size }), { expiresIn: 600 });
}

/** Short-lived signed URL — private files never get permanent public URLs. */
export async function presignDownload(key: string, filename: string, inline = true) {
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.s3.bucket, Key: key, ResponseContentDisposition: disposition }), { expiresIn: 300 });
}

export async function headObject(key: string) {
  const r = await s3().send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
  return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? "" };
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: contentType }));
}
