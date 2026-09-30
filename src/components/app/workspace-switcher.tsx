"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import Link from "next/link";
import { switchWorkspaceAction } from "@/server/actions/workspace";
import { Avatar } from "@/components/ui/primitives";

export function WorkspaceSwitcher({ workspaces, current }: { workspaces: { id: string; name: string }[]; current: { id: string; name: string; logoUrl?: string | null } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.04]">
        <Avatar name={current.name} src={current.logoUrl} size={28} className="rounded-lg" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{current.name}</span>
        <ChevronsUpDown className="size-3.5 text-subtle" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-line bg-surface-2 p-1 shadow-2xl">
          {workspaces.map((w) => (
            <button
              key={w.id}
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                if (w.id === current.id) return;
                const r = await switchWorkspaceAction(w.id);
                if (r.ok) {
                  router.push("/app");
                  router.refresh();
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/[0.05]"
            >
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === current.id && <Check className="size-3.5 text-accent" />}
            </button>
          ))}
          <Link href="/onboarding?new=1" role="menuitem" className="mt-1 flex items-center gap-2 border-t border-line px-2 pb-1 pt-2 text-sm text-muted hover:text-fg">
            <Plus className="size-3.5" /> New workspace
          </Link>
        </div>
      )}
    </div>
  );
}
