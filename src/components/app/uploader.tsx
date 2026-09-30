"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/errors";
import { requestUploadAction, completeUploadAction } from "@/server/actions/files";
import { Tr, useI18n } from "@/lib/i18n/client";

type Target = { projectId?: string; clientId?: string; phaseId?: string; taskId?: string; deliverableVersionId?: string; invoiceId?: string; expenseId?: string };
type Item = { id: number; name: string; progress: number; state: "uploading" | "done" | "error"; error?: string };

type UploadTarget = { url: string } | { blob: { pathname: string; token: string } } | { chunks: { key: string; chunkSize: number } };

/** Built-in storage: send the file in chunks to our own endpoint. */
async function putChunks(key: string, chunkSize: number, file: File, onProgress: (p: number) => void) {
  const parts = Math.max(1, Math.ceil(file.size / chunkSize));
  for (let idx = 0; idx < parts; idx++) {
    const body = file.slice(idx * chunkSize, (idx + 1) * chunkSize);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const r = await fetch(`/api/upload-chunk?key=${encodeURIComponent(key)}&idx=${idx}`, { method: "POST", body, headers: { "Content-Type": "application/octet-stream" } }).catch(() => null);
      ok = Boolean(r?.ok);
    }
    if (!ok) throw new Error("Network error during upload.");
    onProgress(Math.round(((idx + 1) / parts) * 100));
  }
}
type RequestFn = (i: { name: string; mimeType: string; size: number; visibility: "INTERNAL" | "CLIENT_VISIBLE"; category?: string; target: Target }) => Promise<ActionResult<{ fileId: string } & UploadTarget>>;
type CompleteFn = (id: string) => Promise<ActionResult<unknown>>;

function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Storage rejected the upload.")));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

/** Direct-to-storage uploader with progress. Quotas and types are enforced server-side before any byte is sent. */
export function Uploader({ target, configured, defaultVisibility = "INTERNAL", allowVisibility = true, category, compact, request = requestUploadAction as RequestFn, complete = completeUploadAction as CompleteFn, onUploaded, maxMb = 200 }: { target: Target; configured: boolean; maxMb?: number; defaultVisibility?: "INTERNAL" | "CLIENT_VISIBLE"; allowVisibility?: boolean; category?: string; compact?: boolean; request?: RequestFn; complete?: CompleteFn; onUploaded?: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [visibility, setVisibility] = useState(defaultVisibility);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!configured)
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
        <UploadCloud className="mx-auto mb-2 size-5 text-subtle" />
        <Tr>File storage isn&apos;t configured on this platform yet, so uploads are disabled.</Tr>
      </div>
    );

  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const id = Date.now() + Math.random();
      const set = (p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
      setItems((xs) => [...xs, { id, name: file.name, progress: 0, state: "uploading" }]);
      try {
        const r = await request({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, visibility, category, target });
        if (!r.ok) throw new Error(r.error);
        if ("chunks" in r.data) await putChunks(r.data.chunks.key, r.data.chunks.chunkSize, file, (p) => set({ progress: p }));
        else if ("blob" in r.data) {
          // Private Vercel Blob store: the token is scoped to this path, type and size.
          const { put: blobPut } = await import("@vercel/blob/client");
          await blobPut(r.data.blob.pathname, file, { access: "private", token: r.data.blob.token, contentType: file.type || "application/octet-stream", multipart: file.size > 20 * 1024 * 1024, onUploadProgress: (e) => set({ progress: Math.round(e.percentage) }) });
        } else await put(r.data.url, file, (p) => set({ progress: p }));
        const c = await complete(r.data.fileId);
        if (!c.ok) throw new Error(c.error);
        set({ state: "done", progress: 100 });
      } catch (e) {
        set({ state: "error", error: e instanceof Error ? e.message : t("Upload failed.") });
      }
    }
    onUploaded?.();
    router.refresh();
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center transition-colors sm:flex-row sm:justify-between sm:text-left", compact ? "px-4 py-3" : "px-5 py-5", drag ? "border-accent bg-accent-soft" : "border-line-strong")}
      >
        <div className="flex items-center gap-3">
          <UploadCloud className="size-5 shrink-0 text-muted" />
          <div className="text-sm"><span className="text-fg"><Tr>Drop files here</Tr></span> <span className="text-muted"><Tr>or</Tr></span> <button type="button" onClick={() => input.current?.click()} className="text-accent hover:underline"><Tr>browse</Tr></button><div className="text-xs text-subtle">{t("PDF, images, documents, videos, archives · up to {n} MB", { n: maxMb })}</div></div>
        </div>
        {allowVisibility && (
          <div className="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label={t("Visibility of uploaded files")}>
            <button type="button" role="radio" aria-checked={visibility === "INTERNAL"} onClick={() => setVisibility("INTERNAL")} className={cn("flex items-center gap-1 rounded-md px-2 py-1", visibility === "INTERNAL" ? "bg-white/[0.08] text-fg" : "text-muted")}><EyeOff className="size-3" /><Tr>Internal</Tr></button>
            <button type="button" role="radio" aria-checked={visibility === "CLIENT_VISIBLE"} onClick={() => setVisibility("CLIENT_VISIBLE")} className={cn("flex items-center gap-1 rounded-md px-2 py-1", visibility === "CLIENT_VISIBLE" ? "bg-accent-soft text-[#9db9ff]" : "text-muted")}><Eye className="size-3" /><Tr>Visible to client</Tr></button>
          </div>
        )}
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-xs">
              {it.state === "done" ? <CheckCircle2 className="size-3.5 text-success" /> : it.state === "error" ? <AlertCircle className="size-3.5 text-danger" /> : <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-accent" />}
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              {it.state === "uploading" && <span className="num text-muted">{it.progress}%</span>}
              {it.state === "error" && <span className="text-danger">{t(it.error ?? t("Upload failed."))}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
