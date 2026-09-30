import Link from "next/link";
import { Check, Circle, Eye, CreditCard, Upload, MessageSquare, ChevronRight, FileText } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { ProgressBar, Badge } from "@/components/ui/primitives";
import { InvoiceStatusBadge, DeliverableStatusBadge } from "@/components/status";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtShortDate, daysBetween } from "@/lib/format";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";
import type { WaitingItem } from "@/server/queries/portal";
import type { portalProjectHome } from "@/server/queries/portal";
import { cn } from "@/lib/cn";

type Home = Awaited<ReturnType<typeof portalProjectHome>>;

const kindIcon = { REVIEW: Eye, PAY: CreditCard, UPLOAD: Upload, INFO: MessageSquare };

export function WaitingForYou({ items, preview }: { items: WaitingItem[]; preview?: boolean }) {
  if (!items.length)
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-4 text-sm text-muted">
        <span className="flex size-7 items-center justify-center rounded-full bg-success-soft text-success"><Check className="size-4" /></span>
        Nothing needs your attention right now.
      </div>
    );
  return (
    <section aria-labelledby="waiting-title" className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 sm:p-5">
      <h2 id="waiting-title" className="text-[15px] font-semibold">{items.length} item{items.length > 1 ? "s" : ""} need{items.length > 1 ? "" : "s"} your attention</h2>
      <ul className="mt-3 space-y-2">
        {items.map((it) => {
          const Icon = kindIcon[it.kind];
          const [cents, cur] = it.amount?.split("|") ?? [];
          const Wrapper = preview ? "div" : Link;
          return (
            <li key={it.key}>
              <Wrapper href={it.href} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface/80 px-3.5 py-3 transition-colors hover:border-line-strong">
                <Icon className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{it.title}</span><span className="block truncate text-xs text-muted">{it.subtitle}</span></span>
                <span className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium", it.kind === "PAY" ? "bg-accent text-white" : "bg-white/[0.08]")}>{it.kind === "PAY" && cents ? `Pay ${formatMoney(Number(cents), cur)}` : it.cta}</span>
              </Wrapper>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ClientTimeline({ phases, expandable = true }: { phases: Home["phases"]; expandable?: boolean }) {
  if (!phases.length) return <p className="text-sm text-subtle">The project plan will appear here.</p>;
  const currentIdx = phases.findIndex((p) => p.status !== "COMPLETED");
  return (
    <ol className="relative space-y-1" aria-label="Project timeline">
      {phases.map((p, i) => {
        const done = p.status === "COMPLETED";
        const current = i === currentIdx;
        const Body = (
          <div className="flex items-start gap-3.5">
            <div className="flex flex-col items-center self-stretch">
              {done ? <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-accent"><Check className="size-3.5" /></span> : current ? <span className="flex size-6 items-center justify-center rounded-full border-2 border-accent"><span className="size-2 rounded-full bg-accent" /></span> : <Circle className="size-6 text-white/15" />}
              {i < phases.length - 1 && <span className={cn("mt-1 w-px flex-1", done ? "bg-accent/40" : "bg-line")} />}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm", done ? "text-muted" : current ? "font-medium text-fg" : "text-subtle")}>{p.title}</span>
                <span className="num shrink-0 text-xs text-subtle">{done ? "Done" : current ? `${p.progress}%` : p.deadline ? fmtShortDate(p.deadline) : ""}</span>
              </div>
              {current && <ProgressBar value={p.progress} size="sm" className="mt-2" label={`${p.title} progress`} />}
            </div>
          </div>
        );
        if (!expandable || (!p.tasks.length && !p.milestones.length && !p.description)) return <li key={p.id}>{Body}</li>;
        return (
          <li key={p.id}>
            <details open={current} className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{Body}</summary>
              <div className="mb-4 ml-10 space-y-2 rounded-xl border border-line p-3 text-sm">
                {p.description && <p className="text-muted">{p.description}</p>}
                {p.milestones.map((m) => <div key={m.id} className="flex items-center justify-between gap-2 text-xs"><span className={m.completedAt ? "text-success" : "text-muted"}>◆ {m.title}</span><span className="text-subtle">{m.completedAt ? "Reached" : m.dueDate ? fmtShortDate(m.dueDate) : ""}</span></div>)}
                {p.tasks.map((t) => <div key={t.id} className="flex items-center gap-2"><TaskDot s={t.status} /><span className={cn("text-[13px]", t.status === "COMPLETED" && "text-muted")}>{t.title}</span></div>)}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

function TaskDot({ s }: { s: TaskStatus }) {
  if (s === "COMPLETED") return <Check className="size-3.5 text-accent" aria-label="Completed" />;
  if (s === "IN_PROGRESS" || s === "IN_REVIEW") return <span className="size-2 rounded-full bg-accent" aria-label="In progress" />;
  return <span className="size-2 rounded-full border border-white/20" aria-label="Upcoming" />;
}

function MaybeLink({ preview, ...props }: { preview?: boolean; href: string; className?: string; children: React.ReactNode }) {
  return preview ? <span className={props.className}>{props.children}</span> : <Link {...props} />;
}

/** The 5-second view: progress, current stage, what's waiting, latest update, timeline, files, invoices. */
export function PortalProjectHome({ project, home, waiting, base, preview }: { project: { id: string; name: string; progress: number; status: string; targetDate: Date | null; completedAt: Date | null }; home: Home; waiting: WaitingItem[]; base: string; preview?: boolean }) {
  const latest = home.updates[0];
  const left = project.targetDate ? daysBetween(new Date(), project.targetDate) : null;
  return (
    <div className="space-y-8 sm:space-y-10">
      <section aria-label="Progress">
        {project.status === "COMPLETED" ? (
          <div className="flex items-center gap-2 text-sm text-success"><Check className="size-4" />Project completed {fmtDate(project.completedAt)}</div>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <div className="num text-6xl font-semibold tracking-tight sm:text-7xl">{project.progress}<span className="text-3xl text-muted sm:text-4xl">%</span></div>
            <div className="mt-1 text-sm text-muted">complete</div>
          </div>
          <div className="text-right text-sm">
            {home.current && <div><span className="text-muted">Current stage</span><div className="text-base font-medium">{home.current.title}</div></div>}
          </div>
        </div>
        <ProgressBar value={project.progress} size="lg" className="mt-4" label="Project progress" />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          {home.nextMilestone && <span>Next milestone: <span className="text-fg">{home.nextMilestone.title}</span>{home.nextMilestone.dueDate ? ` · ${fmtShortDate(home.nextMilestone.dueDate)}` : ""}</span>}
          {project.targetDate && project.status !== "COMPLETED" && <span>Target {fmtDate(project.targetDate)}{left !== null && left >= 0 ? ` · ${left} days left` : ""}</span>}
        </div>
      </section>

      <WaitingForYou items={waiting} preview={preview} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
        <div className="space-y-8">
          {home.happening.length > 0 && (
            <section>
              <h2 className="mb-3 text-[13px] font-semibold">What&apos;s happening now</h2>
              <ul className="space-y-2">{home.happening.map((t) => <li key={t.id} className="flex items-center gap-2.5 text-sm"><span className="size-2 rounded-full bg-accent" />{t.title}</li>)}</ul>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-[13px] font-semibold">Latest update</h2>
            {latest ? (
              <article className="glass rounded-2xl p-5">
                <div className="text-xs text-subtle">{fmtDate(latest.publishedAt, { month: "long", day: "numeric" })} · {latest.authorName}</div>
                {latest.title && <h3 className="mt-2 font-medium">{latest.title}</h3>}
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted">{latest.body}</p>
                {latest.nextSteps && <p className="mt-4 text-sm"><span className="text-subtle">Next: </span>{latest.nextSteps}</p>}
              </article>
            ) : <p className="text-sm text-subtle">No updates yet.</p>}
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-semibold">Timeline</h2><MaybeLink preview={preview} href={`${base}/projects/${project.id}/plan`} className="text-xs text-muted hover:text-fg">Full plan</MaybeLink></div>
            <ClientTimeline phases={home.phases} />
          </section>
        </div>
        <div className="space-y-8">
          {home.deliverables.length > 0 && (
            <section>
              <h2 className="mb-3 text-[13px] font-semibold">Deliverables</h2>
              <ul className="panel divide-y divide-line rounded-2xl">
                {home.deliverables.slice(0, 5).map((d) => (
                  <li key={d.id}><MaybeLink preview={preview} href={`${base}/projects/${project.id}/deliverables/${d.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]"><span className="min-w-0 flex-1 truncate">{d.title} <span className="text-subtle">V{d.currentVersion}</span></span><DeliverableStatusBadge s={d.status} /><ChevronRight className="size-4 text-subtle" /></MaybeLink></li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-semibold">Latest files</h2><MaybeLink preview={preview} href={`${base}/projects/${project.id}/files`} className="text-xs text-muted hover:text-fg">All files</MaybeLink></div>
            {home.files.length === 0 ? <p className="text-sm text-subtle">No files shared yet.</p> : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                {home.files.slice(0, 6).map((f) => (
                  <li key={f.id}>
                    <a href={preview ? undefined : `/api/files/${f.id}`} target="_blank" rel="noreferrer" className="panel block overflow-hidden rounded-xl">
                      <div className="flex aspect-[4/3] items-center justify-center border-b border-line bg-white/[0.02]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {f.mimeType.startsWith("image/") && !preview ? <img src={`/api/files/${f.id}`} alt="" loading="lazy" className="size-full object-cover" /> : <FileText className="size-6 text-muted" />}
                      </div>
                      <div className="truncate px-2.5 py-2 text-xs">{f.name}</div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-semibold">Invoices</h2><MaybeLink preview={preview} href={`${base}/invoices`} className="text-xs text-muted hover:text-fg">All invoices</MaybeLink></div>
            {home.invoices.length === 0 ? <p className="text-sm text-subtle">No invoices yet.</p> : (
              <ul className="panel divide-y divide-line rounded-2xl">
                {home.invoices.map((i) => (
                  <li key={i.id}><MaybeLink preview={preview} href={`${base}/invoices/${i.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]"><span className="num min-w-0 flex-1 truncate">{i.number}</span><span className="num">{formatMoney(outstandingCents(i) || i.totalCents, i.currency)}</span><InvoiceStatusBadge s={deriveStatus(i)} /></MaybeLink></li>
                ))}
              </ul>
            )}
          </section>
          {preview && <Badge tone="accent">Preview — this is exactly what your client sees</Badge>}
        </div>
      </div>
    </div>
  );
}
