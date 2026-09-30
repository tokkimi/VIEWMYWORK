import { cn } from "@/lib/cn";

/** Minimal, accessible bar chart (SVG-free, pure CSS). Each bar carries its value for screen readers. */
export function BarChart({ data, format, muted, height = 160 }: { data: { label: string; value: number }[]; format: (v: number) => string; muted?: boolean; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) return <p className="flex items-center justify-center text-sm text-subtle" style={{ height }}>No data yet</p>;
  return (
    <figure>
      <ul className="flex items-end gap-1.5" style={{ height }} aria-label="Chart">
        {data.map((d) => (
          <li key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" aria-label={`${d.label}: ${format(d.value)}`}>
            <div className={cn("w-full rounded-t-[5px] transition-colors", muted ? "bg-white/15 group-hover:bg-white/25" : "bg-accent/70 group-hover:bg-accent")} style={{ height: `${Math.max(d.value ? 2 : 0, (d.value / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-3 px-1.5 py-0.5 text-[10px] group-hover:block">{format(d.value)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1.5">{data.map((d) => <span key={d.label} className="num flex-1 text-center text-[10px] text-subtle">{d.label}</span>)}</div>
    </figure>
  );
}
