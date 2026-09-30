import { db } from "@/lib/db";
import { SitePreviewMini } from "@/components/app/site-preview";
import Link from "next/link";
import { Check, Circle, Eye, CreditCard, Upload, MessageSquare, ChevronRight, FileText } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { ProgressBar, Badge } from "@/components/ui/primitives";
import { InvoiceStatusBadge, DeliverableStatusBadge } from "@/components/status";
import { daysBetween } from "@/lib/format";
import { deriveStatus, outstandingCents } from "@/lib/invoices/status";
import type { WaitingItem } from "@/server/queries/portal";
import type { portalProjectHome } from "@/server/queries/portal";
import { cn } from "@/lib/cn";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

type Home = Awaited<ReturnType<typeof portalProjectHome>>;

const kindIcon = { REVIEW: Eye, PAY: CreditCard, UPLOAD: Upload, INFO: MessageSquare };

export async function WaitingForYou({ items, preview }: { items: WaitingItem[]; preview?: boolean }) {
  const { t, fmt, p } = await getI18n();
  if (!items.length)
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-4 text-sm text-muted">
        <span className="flex size-7 items-center justify-center rounded-full bg-success-soft text-success"><Check className="size-4" /></span>
        <Tr>Nothing needs your attention right now.</Tr>
      </div>
    );
  return (
    <section aria-labelledby="waiting-title" className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 sm:p-5">
      <h2 id="waiting-title" className="text-[15px] font-semibold">{p(items.length, "{n} item needs your attention", "{n} items need your attention")}</h2>
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
                <span className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium", it.kind === "PAY" ? "bg-accent text-white" : "bg-white/[0.08]")}>{it.kind === "PAY" && cents ? t("Pay {amount}", { amount: fmt.money(Number(cents), cur) }) : it.cta}</span>
              </Wrapper>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export async function ClientTimeline({ phases, expandable = true }: { phases: Home["phases"]; expandable?: boolean }) {
  const { t, fmt } = await getI18n();
  if (!phases.length) return <p className="text-sm text-subtle"><Tr>The project plan will appear here.</Tr></p>;
  const currentIdx = phases.findIndex((p) => p.status !== "COMPLETED");
  return (
    <ol className="relative space-y-1" aria-label={t("Project timeline")}>
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
                <span className="num shrink-0 text-xs text-subtle">{done ? t("Done") : current ? `${p.progress}%` : p.deadline ? fmt.short(p.deadline) : ""}</span>
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
                {p.milestones.map((m) => <div key={m.id} className="flex items-center justify-between gap-2 text-xs"><span className={m.completedAt ? "text-success" : "text-muted"}>◆ {m.title}</span><span className="text-subtle">{m.completedAt ? t("Reached") : m.dueDate ? fmt.short(m.dueDate) : ""}</span></div>)}
                {p.tasks.map((t) => <div key={t.id} className="flex items-center gap-2"><TaskDot s={t.status} /><span className={cn("text-[13px]", t.status === "COMPLETED" && "text-muted")}>{t.title}</span></div>)}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

async function TaskDot({ s }: { s: TaskStatus }) {
  const { t } = await getI18n();
  if (s === "COMPLETED") return <Check className="size-3.5 text-accent" aria-label={t("Completed")} />;
  if (s === "IN_PROGRESS" || s === "IN_REVIEW") return <span className="size-2 rounded-full bg-accent" aria-label={t("In progress")} />;
  return <span className="size-2 rounded-full border border-white/20" aria-label={t("Upcoming")} />;
}

function MaybeLink({ preview, ...props }: { preview?: boolean; href: string; className?: string; children: React.ReactNode }) {
  return preview ? <span className={props.className}>{props.children}</span> : <Link {...props} />;
}

/** The 5-second view: progress, current stage, what's waiting, latest update, timeline, files, invoices. */
/** The client's website for a project (project site, else first client-visible preview), or nothing. */
async function projectSite(projectId: string, name: string) {
  const row = await db.project.findUnique({ where: { id: projectId }, select: { websiteUrl: true, websiteEmbeddable: true } });
  if (row?.websiteUrl) return { url: row.websiteUrl, label: name, embeddable: row.websiteEmbeddable, imageUrl: null, pageTitle: null };
  return db.preview.findFirst({ where: { projectId, visibility: "CLIENT_VISIBLE" }, orderBy: [{ type: "desc" }, { createdAt: "asc" }], select: { url: true, label: true, embeddable: true, imageUrl: true, pageTitle: true } });
}

/** "Your website" block shown to the client right under what needs their attention. */
export async function ProjectSitePreview({ projectId, name, showName }: { projectId: string; name: string; showName?: boolean }) {
  const site = await projectSite(projectId, name);
  if (!site) return null;
  return (
    <section aria-label={name}>
      <h2 className="mb-3 text-[13px] font-semibold tracking-tight"><Tr>Your website</Tr>{showName && <span className="font-normal text-muted"> · {name}</span>}</h2>
      <SitePreviewMini p={site} />
    </section>
  );
}

export async function PortalProjectHome({ project, home, waiting, base, preview }: { project: { id: string; name: string; progress: number; status: string; targetDate: Date | null; completedAt: Date | null }; home: Home; waiting: WaitingItem[]; base: string; preview?: boolean }) {
  const { t, fmt, p } = await getI18n();
  const latest = home.updates[0];

  const left = project.targetDate ? daysBetween(new Date(), project.targetDate) : null;
  return (
    <div className="space-y-8 sm:space-y-10">
      <section aria-label={t("Progress")}>
        {project.status === "COMPLETED" ? (
          <div className="flex items-center gap-2 text-sm text-success"><Check className="size-4" /><Tr>Project completed</Tr> {fmt.date(project.completedAt)}</div>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <div className="num text-6xl font-semibold tracking-tight sm:text-7xl">{project.progress}<span className="text-3xl text-muted sm:text-4xl">%</span></div>
            <div className="mt-1 text-sm text-muted"><Tr>complete</Tr></div>
          </div>
          <div className="text-right text-sm">
            {home.current && <div><span className="text-muted"><Tr>Current stage</Tr></span><div className="text-base font-medium">{home.current.title}</div></div>}
          </div>
        </div>
        <ProgressBar value={project.progress} size="lg" className="mt-4" label="Project progress" />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          {home.nextMilestone && <span><Tr>Next milestone:</Tr> <span className="text-fg">{home.nextMilestone.title}</span>{home.nextMilestone.dueDate ? ` · ${fmt.short(home.nextMilestone.dueDate)}` : ""}</span>}
          {project.targetDate && project.status !== "COMPLETED" && <span><Tr>Target</Tr> {fmt.date(project.targetDate)}{left !== null && left >= 0 ? ` · ${p(left, "{n} day left", "{n} days left")}` : ""}</span>}
        </div>
      </section>

      <WaitingForYou items={waiting} preview={preview} />

      <ProjectSitePreview projectId={project.id} name={project.name} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
        <div className="space-y-8">
          {home.happening.length > 0 && (
            <section>
              <h2 className="mb-3 text-[13px] font-semibold"><Tr>What&apos;s happening now</Tr></h2>
              <ul className="space-y-2">{home.happening.map((t) => <li key={t.id} className="flex items-center gap-2.5 text-sm"><span className="size-2 rounded-full bg-accent" />{t.title}</li>)}</ul>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-[13px] font-semibold"><Tr>Latest update</Tr></h2>
            {latest ? (
              <article className="glass rounded-2xl p-5">
                <div className="text-xs text-subtle">{fmt.date(latest.publishedAt, { month: "long", day: "numeric" })} · {latest.authorName}</div>
                {latest.title && <h3 className="mt-2 font-medium">{latest.title}</h3>}
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted">{latest.body}</p>
                {latest.nextSteps && <p className="mt-4 text-sm"><span className="text-subtle"><Tr>Next:</Tr> </span>{latest.nextSteps}</p>}
              </article>
            ) : <p className="text-sm text-subtle"><Tr>No updates yet.</Tr></p>}
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-semibold"><Tr>Timeline</Tr></h2><MaybeLink preview={preview} href={`${base}/projects/${project.id}/plan`} className="text-xs text-muted hover:text-fg"><Tr>Full plan</Tr></MaybeLink></div>
            <ClientTimeline phases={home.phases} />
          </section>
        </div>
        <div className="space-y-8">
          {home.deliverables.length > 0 && (
            <section>
              <h2 className="mb-3 text-[13px] font-semibold"><Tr>Deliverables</Tr></h2>
              <ul className="panel divide-y divide-line rounded-2xl">
                {home.deliverables.slice(0, 5).map((d) => (
                  <li key={d.id}><MaybeLink preview={preview} href={`${base}/projects/${project.id}/deliverables/${d.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]"><span className="min-w-0 flex-1 truncate">{d.title} <span className="text-subtle">V{d.currentVersion}</span></span><DeliverableStatusBadge s={d.status} /><ChevronRight className="size-4 text-subtle" /></MaybeLink></li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-semibold"><Tr>Latest files</Tr></h2><MaybeLink preview={preview} href={`${base}/projects/${project.id}/files`} className="text-xs text-muted hover:text-fg"><Tr>All files</Tr></MaybeLink></div>
            {home.files.length === 0 ? <p className="text-sm text-subtle"><Tr>No files shared yet.</Tr></p> : (
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
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-semibold"><Tr>Invoices</Tr></h2><MaybeLink preview={preview} href={`${base}/invoices`} className="text-xs text-muted hover:text-fg"><Tr>All invoices</Tr></MaybeLink></div>
            {home.invoices.length === 0 ? <p className="text-sm text-subtle"><Tr>No invoices yet.</Tr></p> : (
              <ul className="panel divide-y divide-line rounded-2xl">
                {home.invoices.map((i) => (
                  <li key={i.id}><MaybeLink preview={preview} href={`${base}/invoices/${i.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.02]"><span className="num min-w-0 flex-1 truncate">{i.number}</span><span className="num">{fmt.money(outstandingCents(i) || i.totalCents, i.currency)}</span><InvoiceStatusBadge s={deriveStatus(i)} /></MaybeLink></li>
                ))}
              </ul>
            )}
          </section>
          {preview && <Badge tone="accent"><Tr>Preview — this is exactly what your client sees</Tr></Badge>}
        </div>
      </div>
    </div>
  );
}
