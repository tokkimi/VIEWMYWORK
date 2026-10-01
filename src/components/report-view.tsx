import { CheckCircle2, CircleDot, CalendarClock, Hourglass, MessageSquareQuote, Package, Flag } from "lucide-react";
import { ProgressBar, Badge } from "@/components/ui/primitives";
import { DECISION_LABEL } from "@/lib/decisions";
import { progressDelta, type ReportData } from "@/lib/reports";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";

/** A weekly report as the client reads it (also used for the professional's preview). */
export async function ReportView({ data, note, sentAt }: { data: ReportData; note?: string | null; sentAt?: Date | null }) {
  const { t, fmt, p } = await getI18n();
  const delta = progressDelta(data);
  const head = (icon: React.ReactNode, label: string) => <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">{icon}{t(label)}</h3>;
  return (
    <div className="space-y-7">
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-subtle">{t("Week of {start} to {end}", { start: fmt.short(data.period.start), end: fmt.short(data.period.end) })}{sentAt ? ` · ${t("sent {date}", { date: fmt.date(sentAt) })}` : ""}</div>
            <div className="num mt-1 text-4xl font-semibold tracking-tight">{data.project.progress}<span className="text-xl text-muted">%</span></div>
          </div>
          {delta !== null && <Badge tone={delta > 0 ? "success" : "neutral"}>{delta > 0 ? t("+{n} pts this week", { n: delta }) : t("No change this week")}</Badge>}
        </div>
        <ProgressBar value={data.project.progress} className="mt-3" label="Project progress" />
        {data.project.targetDate && <div className="mt-2 text-xs text-muted">{t("Planned delivery: {date}", { date: fmt.date(data.project.targetDate) })}</div>}
      </div>

      {note && (
        <section>
          {head(<MessageSquareQuote className="size-4 text-accent" />, "A word from the team")}
          <p className="whitespace-pre-line rounded-2xl border border-line p-4 text-sm">{note}</p>
        </section>
      )}

      <div className="grid gap-7 md:grid-cols-2">
        <section>
          {head(<CheckCircle2 className="size-4 text-success" />, "Done this week")}
          {data.done.length === 0 ? <p className="text-sm text-subtle"><Tr>Nothing completed this week.</Tr></p> : (
            <ul className="space-y-1.5 text-sm">
              {data.done.map((d, i) => <li key={i} className="flex items-start gap-2">{d.kind === "deliverable" ? <Package className="mt-0.5 size-3.5 shrink-0 text-success" /> : d.kind === "milestone" ? <Flag className="mt-0.5 size-3.5 shrink-0 text-success" /> : <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />}<span>{d.title}{d.kind === "deliverable" && <span className="text-subtle"> · {t("approved")}</span>}</span></li>)}
              {data.doneTotal > data.done.length && <li className="text-xs text-subtle">{t("and {n} more", { n: data.doneTotal - data.done.length })}</li>}
            </ul>
          )}
        </section>
        <section>
          {head(<CircleDot className="size-4 text-accent" />, "In progress")}
          {data.inProgress.length === 0 ? <p className="text-sm text-subtle">—</p> : <ul className="space-y-1.5 text-sm">{data.inProgress.map((x, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />{x}</li>)}</ul>}
        </section>
        <section>
          {head(<CalendarClock className="size-4 text-muted" />, "Next steps")}
          {data.next.length === 0 ? <p className="text-sm text-subtle">—</p> : <ul className="space-y-1.5 text-sm">{data.next.map((x, i) => <li key={i} className="flex items-baseline justify-between gap-3"><span>{x.title}</span>{x.date && <span className="num shrink-0 text-xs text-subtle">{fmt.short(x.date)}</span>}</li>)}</ul>}
        </section>
        <section>
          {head(<Hourglass className="size-4 text-warning" />, "Waiting for you")}
          {data.waiting.length === 0 ? <p className="text-sm text-subtle"><Tr>Nothing is waiting for you.</Tr></p> : (
            <ul className="space-y-1.5 text-sm">
              {data.waiting.map((w, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span>{w.kind === "PAYMENT" ? t("Invoice {number}", { number: w.title }) : w.title} <span className="text-xs text-subtle">· {t(DECISION_LABEL[w.kind])}</span></span>
                  <span className={cn("shrink-0 text-xs", w.days >= 7 ? "text-danger" : "text-subtle")}>{w.days === 0 ? t("Since today") : p(w.days, "waiting for {n} day", "waiting for {n} days")}</span>
                </li>
              ))}
            </ul>
          )}
          {data.waiting.some((w) => w.days >= 7) && <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning"><Tr>Some items have been waiting for over a week and may delay the project.</Tr></p>}
        </section>
      </div>

      {data.update && (
        <section>
          {head(<MessageSquareQuote className="size-4 text-muted" />, data.update.title || "Latest update")}
          <div className="rounded-2xl border border-line p-4 text-sm">
            <p className="whitespace-pre-line text-muted">{data.update.body}</p>
            {data.update.nextSteps && <p className="mt-3"><span className="text-subtle"><Tr>Next:</Tr> </span>{data.update.nextSteps}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
