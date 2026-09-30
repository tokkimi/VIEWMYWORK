import type { ReactNode, ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { Tx } from "@/lib/i18n/client";

export function Card({ className, children, ...p }: ComponentProps<"div">) {
  return (
    <div className={cn("glass rounded-2xl", className)} {...p}>
      {children}
    </div>
  );
}

export function Section({ title, action, children, className, description }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; description?: ReactNode }) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-fg"><Tx>{title}</Tx></h2>
          {description && <p className="mt-0.5 text-xs text-muted"><Tx>{description}</Tx></p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2"><Tx>{eyebrow}</Tx></div>}
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[28px]"><Tx>{title}</Tx></h1>
        {description && <p className="mt-1.5 text-sm text-muted"><Tx>{description}</Tx></p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-muted",
  accent: "bg-accent-soft text-[#8fb0ff]",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      <Tx>{children}</Tx>
    </span>
  );
}

export function ProgressBar({ value, className, size = "md", label }: { value: number; className?: string; size?: "sm" | "md" | "lg"; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const h = { sm: "h-1", md: "h-1.5", lg: "h-2.5" }[size];
  return (
    <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"} className={cn("w-full overflow-hidden rounded-full bg-white/[0.07]", h, className)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ name, src, size = 28, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-3 font-medium text-muted", className)} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }} title={name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-muted [&_svg]:size-5">{icon}</div>}
      <h3 className="text-[15px] font-medium"><Tx>{title}</Tx></h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted"><Tx>{description}</Tx></p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warning" | "accent" }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <div className="truncate text-xs text-muted"><Tx>{label}</Tx></div>
      <div className={cn("num mt-1 truncate text-xl font-semibold tracking-tight", tone === "danger" && "text-danger", tone === "warning" && "text-warning", tone === "accent" && "text-accent")}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-subtle"><Tx>{hint}</Tx></div>}
    </div>
  );
}

export function KeyValue({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {items.map((i) => (
        <div key={i.k} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-muted"><Tx>{i.k}</Tx></dt>
          <dd className="min-w-0 break-words text-right">{i.v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("panel overflow-x-auto rounded-2xl", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-subtle border-b border-line";
export const td = "px-4 py-3 border-b border-line align-middle";
