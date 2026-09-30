import type { File as FileRow } from "@prisma/client";

export type FileDTO = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  category: string;
  visibility: "INTERNAL" | "CLIENT_VISIBLE";
  source: "UPLOAD" | "GOOGLE_DRIVE";
  externalMissing: boolean;
  createdAt: string;
  uploadedByClient: boolean;
};

/** Serialisable view of a File row for client components (BigInt → number). */
export function toFileDTO(f: FileRow): FileDTO {
  return { id: f.id, name: f.name, mimeType: f.mimeType, size: Number(f.sizeBytes), category: f.category, visibility: f.visibility, source: f.source, externalMissing: f.externalMissing, createdAt: f.createdAt.toISOString(), uploadedByClient: f.uploadedByClient };
}
