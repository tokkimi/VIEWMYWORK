import { Check, Circle, CreditCard, FileText, Eye } from "lucide-react";

/** Static rendering of the real client-portal layout, used on marketing pages. */
export function ProductShot() {
  const phases = [
    { t: "Discovery", s: "done" },
    { t: "Design", s: "done" },
    { t: "Development", s: "current" },
    { t: "Testing", s: "todo" },
    { t: "Launch", s: "todo" },
  ];
  return (
    <div className="glass relative overflow-hidden rounded-[22px] p-1.5" aria-label="Preview of the client portal">
      <div className="rounded-[18px] border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="ml-3 truncate rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-subtle">portal · Studio North</span>
        </div>
        <div className="grid gap-0 md:grid-cols-[1.35fr_1fr]">
          <div className="border-line p-6 md:border-r">
            <div className="eyebrow">Website Redesign</div>
            <div className="mt-3 flex items-end gap-3">
              <span className="num text-5xl font-semibold tracking-tight">72%</span>
              <span className="mb-1.5 text-sm text-muted">complete</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full w-[72%] rounded-full bg-accent" />
            </div>
            <p className="mt-3 text-sm text-muted">Currently in <span className="text-fg">Development</span> · Next milestone <span className="text-fg">Mobile QA</span></p>
            <ol className="mt-6 space-y-3">
              {phases.map((p) => (
                <li key={p.t} className="flex items-center gap-3 text-sm">
                  {p.s === "done" ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-accent/15 text-accent"><Check className="size-3" /></span>
                  ) : p.s === "current" ? (
                    <span className="flex size-5 items-center justify-center rounded-full border-2 border-accent"><span className="size-1.5 rounded-full bg-accent" /></span>
                  ) : (
                    <Circle className="size-5 text-white/15" />
                  )}
                  <span className={p.s === "todo" ? "text-subtle" : p.s === "current" ? "font-medium" : "text-muted"}>{p.t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">Waiting for you</span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-[#8fb0ff]">2 items</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
                <Eye className="size-4 text-muted" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm">Homepage V2</div><div className="text-[11px] text-subtle">Review & approve</div></div>
                <span className="rounded-lg bg-white/[0.07] px-2.5 py-1 text-[11px]">Review</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
                <CreditCard className="size-4 text-muted" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm">INV-2026-0042</div><div className="text-[11px] text-subtle">Due Oct 15</div></div>
                <span className="rounded-lg bg-accent px-2.5 py-1 text-[11px] text-white">Pay €1,200</span>
              </div>
            </div>
            <div className="mt-6 text-[13px] font-semibold">Latest update</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">Dashboard development is complete. Next: mobile responsiveness and client testing.</p>
            <div className="mt-6 text-[13px] font-semibold">Latest files</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["Brand-guide.pdf", "Sitemap.pdf", "Contract.pdf"].map((f) => (
                <div key={f} className="rounded-lg border border-line bg-white/[0.02] p-2">
                  <FileText className="size-4 text-muted" />
                  <div className="mt-2 truncate text-[10px] text-subtle">{f}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
