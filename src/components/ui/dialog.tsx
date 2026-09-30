"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Accessible modal built on the native <dialog> element (focus trapping + Esc handled by the browser). */
export function Dialog({ trigger, title, description, children, size = "md", open: controlledOpen, onOpenChange }: { trigger?: (open: () => void) => ReactNode; title: string; description?: string; children: ReactNode | ((close: () => void) => ReactNode); size?: "sm" | "md" | "lg" | "xl"; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInnerOpen(o));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => setOpen(false);
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];

  return (
    <>
      {trigger?.(() => setOpen(true))}
      <dialog
        ref={ref}
        onClose={close}
        onClick={(e) => e.target === ref.current && close()}
        aria-labelledby="dialog-title"
        className={cn("m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/70", width)}
      >
        {open && (
          <div className="max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
              <div>
                <h2 id="dialog-title" className="text-[15px] font-semibold">{title}</h2>
                {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
              </div>
              <button onClick={close} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-fg">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 py-5">{typeof children === "function" ? children(close) : children}</div>
          </div>
        )}
      </dialog>
    </>
  );
}
