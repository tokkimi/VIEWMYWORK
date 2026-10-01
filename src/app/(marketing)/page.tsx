import { Activity, ArrowRight, CheckCircle2, FileStack, Gauge, ListChecks, MessageSquare, MessageSquareDiff, MonitorSmartphone, Receipt, RefreshCw, Send, ShieldCheck, Sparkles, Hourglass, FileBarChart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ProductShot } from "@/components/marketing/product-shot";
import { DeveloperPreviewShowcase } from "@/components/marketing/developer-preview-showcase";
import { getI18n } from "@/lib/i18n/server";

const loop = ["Specification", "Execution", "Progress", "Documents", "Deliverables", "Approval", "Invoice", "Payment"];

export default async function Home() {
  const { t } = await getI18n();
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="glow pointer-events-none absolute inset-0" />
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {t("Your clients shouldn't have to ask")} <span className="text-muted">{t("“Where are we?”")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted sm:text-lg">
              {t("Manage specifications, progress, deliverables, documents and client approvals from one beautifully simple portal.")}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup" variant="primary" size="lg">Start free <ArrowRight className="size-4" /></ButtonLink>
              <ButtonLink href="/features" variant="secondary" size="lg">See how it works</ButtonLink>
            </div>
            <p className="mt-4 text-xs text-subtle">{t("7-day free trial · From €2/month · Card required, nothing charged today")}</p>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <ProductShot />
          </div>
        </div>
      </section>

      <DeveloperPreviewShowcase />

      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow text-center">{t("One continuous flow")}</p>
          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {loop.map((s, i) => (
              <span key={s} className="flex items-center gap-2 text-sm">
                <span className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5">{t(s)}</span>
                {i < loop.length - 1 && <ArrowRight className="size-3.5 text-subtle" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{t("You manage the complexity.")}<br /><span className="text-muted">{t("Your client sees simplicity.")}</span></h2>
            <p className="mt-4 text-muted">{t("Build a complete specification with phases, milestones, tasks and deliverables. Mark what the client can see. Everything else stays internal — enforced on the server, not hidden with CSS.")}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              [ListChecks, "Specification builder", "Phases, milestones, tasks, weights and dependencies."],
              [Sparkles, "Honest progress", "Weighted progress calculated from real work."],
              [FileStack, "Shared files", "One-tap sharing, both sides see the same files, 30-day restore."],
              [MonitorSmartphone, "Website previews", "The client's site in desktop and mobile, live or as a full-page capture."],
              [CheckCircle2, "Approvals", "Versioned deliverables with full approval history."],
              [MessageSquareDiff, "Change requests", "The client picks the topic and the page; you're notified instantly."],
              [Receipt, "Invoices & payments", "Send invoices, get paid online, track every euro."],
              [MessageSquare, "Contextual messages", "Internal or client-visible — always explicit."],
            ].map(([Icon, title, d]) => {
              const I = Icon as typeof ListChecks;
              return (
                <li key={title as string} className="glass rounded-2xl p-5">
                  <I className="size-5 text-accent" />
                  <div className="mt-4 text-sm font-medium">{t(title as string)}</div>
                  <div className="mt-1 text-[13px] text-muted">{t(d as string)}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>


      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow">{t("New · Steer your business")}</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight">{t("Not just a client portal: a cockpit for your whole team.")}</h2>
          <p className="mt-4 max-w-2xl text-muted">{t("See who is overloaded, which project is drifting and where your margin goes — before it becomes a problem.")}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-medium"><Gauge className="size-5 text-accent" />{t("Team workload")}</div>
              <p className="mt-2 text-[13px] text-muted">{t("Planned hours against each person's capacity, six weeks ahead, with absences and part-time. Unassigned tasks get a suggested owner — assign them all in one click.")}</p>
              <div className="mt-5 space-y-2" aria-hidden>
                {[["Sophie", [62, 88, 54, 30]], ["Lucas", [96, 112, 71, 40]], ["Inès", [35, 48, 66, 82]]].map(([n, v]) => (
                  <div key={n as string} className="flex items-center gap-2 text-xs">
                    <span className="w-12 text-muted">{n as string}</span>
                    {(v as number[]).map((x, i) => <span key={i} className={`num flex-1 rounded-md py-1.5 text-center ${x > 100 ? "bg-danger-soft text-danger" : x >= 85 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>{x}%</span>)}
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-medium"><Activity className="size-5 text-accent" />{t("Project health")}</div>
              <p className="mt-2 text-[13px] text-muted">{t("A score and concrete alerts for every project: delay versus expected progress, budget consumed and overrun forecast, client approvals blocking you, margin and next deadlines.")}</p>
              <ul className="mt-5 space-y-2 text-xs" aria-hidden>
                <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span>{t("Brand redesign")}</span><span className="rounded-full bg-success-soft px-2 py-0.5 text-success">{t("On track")} · 92</span></li>
                <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span>{t("Mobile app")}</span><span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">{t("At risk")} · 64</span></li>
                <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span>{t("E-shop")}</span><span className="rounded-full bg-danger-soft px-2 py-0.5 text-danger">{t("Off track")} · 41</span></li>
              </ul>
            </div>
            <div className="glass rounded-2xl p-6 md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 text-sm font-medium"><Hourglass className="size-5 text-accent" />{t("Client decisions")}</div>
              <p className="mt-2 text-[13px] text-muted">{t("Everything waiting for your clients in one list — approvals, documents, information, payments and scope changes they accept from their portal — with automatic reminders.")}</p>
              <ul className="mt-5 space-y-2 text-xs" aria-hidden>
                <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span>{t("Homepage V2")}</span><span className="text-muted">{t("Approval")} · <span className="text-danger">{t("{n} d", { n: 8 })}</span></span></li>
                <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span>{t("Product photos")}</span><span className="text-muted">{t("Document")} · <span className="text-warning">{t("{n} d", { n: 4 })}</span></span></li>
                <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span>{t("Extra blog page")}</span><span className="text-muted">{t("Scope decision")} · {t("{n} d", { n: 1 })}</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [RefreshCw, "Real-time on both sides", "You and your client see the same shared content, updated within seconds — no refresh needed."],
              [Send, "Share by email, WhatsApp or link", "Clients without email get their private access by WhatsApp or any app, in one tap."],
              [ShieldCheck, "Nothing gets lost", "Deleted files stay recoverable for 30 days, with a full history of who did what."],
              [FileBarChart, "Weekly reports, written for you", "Every client gets a clear weekly summary of their project, and you get your portfolio digest — without writing a line."],
            ].map(([Icon, title, d]) => {
              const I = Icon as typeof Gauge;
              return (
                <div key={title as string} className="rounded-2xl border border-line p-5">
                  <I className="size-5 text-accent" />
                  <div className="mt-3 text-sm font-medium">{t(title as string)}</div>
                  <div className="mt-1 text-[13px] text-muted">{t(d as string)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-24 text-center">
          <ShieldCheck className="mx-auto size-6 text-accent" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight">{t("Everything about the project, in one place.")}</h2>
          <p className="mt-3 text-muted">{t("Stop explaining where things stand, sending files through five channels, chasing approvals and then separately sending an invoice.")}</p>
          <div className="mt-8"><ButtonLink href="/signup" variant="primary" size="lg">Start free <ArrowRight className="size-4" /></ButtonLink></div>
        </div>
      </section>
    </>
  );
}
