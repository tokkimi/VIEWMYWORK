"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

type Toast = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<{ success: (t: string) => void; error: (t: string) => void }>({ success: () => {}, error: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { t: tr } = useI18n();
  // English literals passed by callers are translated here; server messages arrive already translated.
  const push = useCallback((kind: Toast["kind"], raw: string) => {
    const id = Date.now() + Math.random();
    const text = tr(raw);
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, [tr]);
  return (
    <Ctx.Provider value={{ success: (t) => push("success", t), error: (t) => push("error", t) }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className="glass pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl bg-surface-2/90 px-3.5 py-3 text-sm">
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
            <span className="flex-1">{t.text}</span>
            <button aria-label="×" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
