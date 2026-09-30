"use client";

import { useState } from "react";
import { MoreHorizontal, CheckCircle2, Archive, ArchiveRestore, RotateCcw } from "lucide-react";
import { useActionButton } from "./invoice-actions";
import { completeProjectAction, archiveProjectAction, reopenProjectAction } from "@/server/actions/projects";

export function ProjectMoreMenu({ projectId, status, archived }: { projectId: string; name: string; status: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useActionButton();
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/[0.05] disabled:opacity-50";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="More actions" className="flex size-9 items-center justify-center rounded-[10px] border border-line text-muted hover:text-fg">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
            {status !== "COMPLETED" ? (
              <button role="menuitem" disabled={pending} className={item} onClick={() => { setOpen(false); if (confirm("Mark this project as complete? Your client will be notified.")) run(() => completeProjectAction(projectId)); }}>
                <CheckCircle2 className="size-4 text-success" />Mark project complete
              </button>
            ) : (
              <button role="menuitem" disabled={pending} className={item} onClick={() => { setOpen(false); run(() => reopenProjectAction(projectId)); }}>
                <RotateCcw className="size-4 text-muted" />Reopen project
              </button>
            )}
            <button role="menuitem" disabled={pending} className={item} onClick={() => { setOpen(false); if (archived || confirm("Archive this project? It will be hidden from the client portal.")) run(() => archiveProjectAction(projectId, !archived)); }}>
              {archived ? <ArchiveRestore className="size-4 text-muted" /> : <Archive className="size-4 text-muted" />}
              {archived ? "Restore project" : "Archive project"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
