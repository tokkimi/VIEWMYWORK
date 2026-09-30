import { ArrowRight, CheckCircle2, FileStack, ListChecks, MessageSquare, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ProductShot } from "@/components/marketing/product-shot";

const loop = ["Specification", "Execution", "Progress", "Documents", "Deliverables", "Approval", "Invoice", "Payment"];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="glow pointer-events-none absolute inset-0" />
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              Your clients shouldn&apos;t have to ask <span className="text-muted">“Where are we?”</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted sm:text-lg">
              Manage specifications, progress, deliverables, documents and client approvals from one beautifully simple portal.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup" variant="primary" size="lg">Start free <ArrowRight className="size-4" /></ButtonLink>
              <ButtonLink href="/features" variant="secondary" size="lg">See how it works</ButtonLink>
            </div>
            <p className="mt-4 text-xs text-subtle">14-day free trial · From €2/month · No credit card to start</p>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <ProductShot />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow text-center">One continuous flow</p>
          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {loop.map((s, i) => (
              <span key={s} className="flex items-center gap-2 text-sm">
                <span className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5">{s}</span>
                {i < loop.length - 1 && <ArrowRight className="size-3.5 text-subtle" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">You manage the complexity.<br /><span className="text-muted">Your client sees simplicity.</span></h2>
            <p className="mt-4 text-muted">Build a complete specification with phases, milestones, tasks and deliverables. Mark what the client can see. Everything else stays internal — enforced on the server, not hidden with CSS.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              [ListChecks, "Specification builder", "Phases, milestones, tasks, weights and dependencies."],
              [Sparkles, "Honest progress", "Weighted progress calculated from real work."],
              [FileStack, "Files & previews", "Visual file manager and live website previews."],
              [CheckCircle2, "Approvals", "Versioned deliverables with full approval history."],
              [Receipt, "Invoices & payments", "Send invoices, get paid online, track every euro."],
              [MessageSquare, "Contextual messages", "Internal or client-visible — always explicit."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof ListChecks;
              return (
                <li key={t as string} className="glass rounded-2xl p-5">
                  <I className="size-5 text-accent" />
                  <div className="mt-4 text-sm font-medium">{t as string}</div>
                  <div className="mt-1 text-[13px] text-muted">{d as string}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-24 text-center">
          <ShieldCheck className="mx-auto size-6 text-accent" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight">Everything about the project, in one place.</h2>
          <p className="mt-3 text-muted">Stop explaining where things stand, sending files through five channels, chasing approvals and then separately sending an invoice.</p>
          <div className="mt-8"><ButtonLink href="/signup" variant="primary" size="lg">Start free <ArrowRight className="size-4" /></ButtonLink></div>
        </div>
      </section>
    </>
  );
}
