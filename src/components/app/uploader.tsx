"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/errors";
import { requestUploadAction, completeUploadAction } from "@/server/actions/files";

type Target = { projectId?: string; clientId?: string; phaseId?: string; taskId?: string; deliverableVersionId?: string; invoiceId?: string; expenseId?: string };
type Item = { id: number; name: string; progress: number; state: "uploading" | "done" | "error"; error?: string };

type RequestFn = (i: { name: string; mimeType: string; size: number; visibility: "INTERNAL" | "CLIENT_VISIBLE"; category?: string; target: Target }) => Promise<ActionResult<{ fileId: string; url: string }>>;
type CompleteFn = (id: string) => Promise<ActionResult<unknown>>;

function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

/** Direct-to-storage uploader with progress. Quotas and types are enforced server-side before any byte is sent. */
export function Uploader({ target, configured, defaultVisibility = "INTERNAL", allowVisibility = true, category, compact, request = requestUploadAction as RequestFn, complete = completeUploadAction as CompleteFn, onUploaded }: { target: Target; configured: boolean; defaultVisibility?: "INTERNAL" | "CLIENT_VISIBLE"; allowVisibility?: boolean; category?: string; compact?: boolean; request?: RequestFn; complete?: CompleteFn; onUploaded?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [visibility, setVisibility] = useState(defaultVisibility);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!configured)
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
        <UploadCloud className="mx-auto mb-2 size-5 text-subtle" />
        File storage isn&apos;t configured on this platform yet, so uploads are disabled.
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
        await put(r.data.url, file, (p) => set({ progress: p }));
        const c = await complete(r.data.fileId);
        if (!c.ok) throw new Error(c.error);
        set({ state: "done", progress: 100 });
      } catch (e) {
        set({ state: "error", error: e instanceof Error ? e.message : "Upload failed." });
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
          <div className="text-sm"><span className="text-fg">Drop files here</span> <span className="text-muted">or</span> <button type="button" onClick={() => input.current?.click()} className="text-accent hover:underline">browse</button><div className="text-xs text-subtle">PDF, images, documents, videos, archives · up to 200 MB</div></div>
        </div>
        {allowVisibility && (
          <div className="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label="Visibility of uploaded files">
            <button type="button" role="radio" aria-checked={visibility === "INTERNAL"} onClick={() => setVisibility("INTERNAL")} className={cn("flex items-center gap-1 rounded-md px-2 py-1", visibility === "INTERNAL" ? "bg-white/[0.08] text-fg" : "text-muted")}><EyeOff className="size-3" />Internal</button>
            <button type="button" role="radio" aria-checked={visibility === "CLIENT_VISIBLE"} onClick={() => setVisibility("CLIENT_VISIBLE")} className={cn("flex items-center gap-1 rounded-md px-2 py-1", visibility === "CLIENT_VISIBLE" ? "bg-accent-soft text-[#9db9ff]" : "text-muted")}><Eye className="size-3" />Visible to client</button>
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
              {it.state === "error" && <span className="text-danger">{it.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
