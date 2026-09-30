"use client";

import { useState } from "react";
import type { FileDTO } from "@/lib/file-dto";
import { FileText, FileImage, FileVideo, FileArchive, FileSpreadsheet, Presentation, File as FileIcon, LayoutGrid, List, Download, Trash2, Eye, EyeOff, Link2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format-bytes";
import { fmtDate } from "@/lib/format";
import { useActionButton } from "./invoice-actions";
import { deleteFileAction } from "@/server/actions/files";
import { Badge } from "@/components/ui/primitives";

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("gzip")) return FileArchive;
  if (mime.includes("sheet") || mime === "text/csv") return FileSpreadsheet;
  if (mime.includes("presentation")) return Presentation;
  if (mime === "application/pdf" || mime.includes("word") || mime.startsWith("text/")) return FileText;
  return FileIcon;
}

function ext(name: string) {
  const e = name.split(".").pop();
  return e && e !== name ? e.slice(0, 4).toUpperCase() : "FILE";
}

const FILTERS = [
  ["ALL", "All"],
  ["DOCUMENT", "Documents"],
  ["IMAGE", "Images"],
  ["CONTRACT", "Contracts"],
  ["INVOICE", "Invoices"],
  ["DELIVERABLE", "Deliverables"],
  ["OTHER", "Other"],
] as const;

/** Visual file manager: previews first, list view on demand. Access goes through /api/files/:id (authorised + signed). */
export function FileGrid({ files, canManage, showVisibility = true }: { files: FileDTO[]; canManage?: boolean; showVisibility?: boolean }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<string>("ALL");
  const shown = files.filter((f) => filter === "ALL" || f.category === filter || (filter === "IMAGE" && f.mimeType.startsWith("image/")));
  const { pending, run } = useActionButton();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter files">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={cn("h-7 rounded-full px-3 text-xs transition-colors", filter === k ? "bg-white/[0.09] text-fg" : "text-muted hover:text-fg")}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="View">
          <button onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grid view" className={cn("rounded-md p-1.5", view === "grid" ? "bg-white/[0.08]" : "text-muted")}><LayoutGrid className="size-3.5" /></button>
          <button onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="List view" className={cn("rounded-md p-1.5", view === "list" ? "bg-white/[0.08]" : "text-muted")}><List className="size-3.5" /></button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-subtle">No files in this category.</p>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((f) => {
            const Icon = iconFor(f.mimeType);
            return (
              <li key={f.id} className="group panel relative overflow-hidden rounded-xl">
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="block">
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line bg-white/[0.02]">
                    {f.source === "GOOGLE_DRIVE" ? (
                      <div className="flex flex-col items-center gap-2 text-muted"><Link2 className="size-6" /><span className="text-[10px]">Google Drive</span></div>
                    ) : f.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${f.id}`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : f.mimeType.startsWith("video/") ? (
                      <video src={`/api/files/${f.id}#t=0.5`} preload="metadata" muted className="size-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Icon className="size-7 text-muted" />
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted">{ext(f.name)}</span>
                      </div>
                    )}
                    {f.externalMissing && <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-warning"><AlertTriangle className="mr-1 size-3.5" />Unavailable</span>}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="truncate text-[13px]" title={f.name}>{f.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
                      {f.source === "UPLOAD" && <span>{formatBytes(f.size)}</span>}
                      <span>· {fmtDate(f.createdAt, { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                </a>
                {showVisibility && (
                  <span className="absolute left-2 top-2" title={f.visibility === "CLIENT_VISIBLE" ? "Visible to client" : "Internal only"}>
                    {f.visibility === "CLIENT_VISIBLE" ? <Badge tone="accent"><Eye className="size-3" />Client</Badge> : <Badge><EyeOff className="size-3" />Internal</Badge>}
                  </span>
                )}
                {canManage && (
                  <button aria-label={`Delete ${f.name}`} disabled={pending} onClick={() => confirm(`Delete ${f.name}?`) && run(() => deleteFileAction(f.id))} className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="panel divide-y divide-line rounded-2xl">
          {shown.map((f) => {
            const Icon = iconFor(f.mimeType);
            return (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Icon className="size-4 shrink-0 text-muted" />
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{f.name}</a>
                {showVisibility && f.visibility === "CLIENT_VISIBLE" && <Badge tone="accent">Client</Badge>}
                {f.uploadedByClient && <Badge>From client</Badge>}
                <span className="hidden w-20 text-right text-xs text-subtle sm:block">{f.source === "UPLOAD" ? formatBytes(f.size) : "Drive"}</span>
                <span className="hidden w-24 text-right text-xs text-subtle sm:block">{fmtDate(f.createdAt)}</span>
                {f.source === "UPLOAD" && <a href={`/api/files/${f.id}?download=1`} aria-label={`Download ${f.name}`} className="rounded p-1 text-muted hover:text-fg"><Download className="size-3.5" /></a>}
                {canManage && <button aria-label={`Delete ${f.name}`} disabled={pending} onClick={() => confirm(`Delete ${f.name}?`) && run(() => deleteFileAction(f.id))} className="rounded p-1 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
