import { ArrowRight, CheckCircle2, FileStack, Globe2, ListChecks, MessageSquare, MonitorSmartphone, MousePointerClick, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ProductShot } from "@/components/marketing/product-shot";
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

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">{t("Built for delivery teams")}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("Share each deployment with a preview your client can understand.")}</h2>
            <p className="mt-4 text-muted">{t("Developers add a secure preview link as soon as a version is ready. Your client sees the website in a polished desktop, tablet or mobile frame — and can give feedback in the context of the project.")}</p>
            <ul className="mt-7 space-y-4 text-sm text-muted">
              {[
                [Globe2, "Add any staging, Vercel or production URL"],
                [MonitorSmartphone, "Check the experience on desktop, tablet and mobile"],
                [MousePointerClick, "Turn feedback and approval into clear next steps"],
              ].map(([Icon, copy]) => {
                const I = Icon as typeof Globe2;
                return <li key={copy as string} className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft"><I className="size-4 text-accent" /></span>{t(copy as string)}</li>;
              })}
            </ul>
          </div>
          <div className="glass overflow-hidden rounded-2xl p-3 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-line px-3 pb-3 text-xs">
              <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-success" /><span className="font-medium">{t("Preview ready for review")}</span></div>
              <span className="rounded-full bg-accent-soft px-2 py-1 text-accent">{t("Client-visible")}</span>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-[#101827] p-3">
              <div className="flex items-center gap-1.5 border-b border-white/10 pb-3"><span className="size-2 rounded-full bg-[#ff6b6b]" /><span className="size-2 rounded-full bg-[#f6c453]" /><span className="size-2 rounded-full bg-[#58d68d]" /><span className="ml-3 truncate rounded-md bg-white/[0.06] px-3 py-1 text-[10px] text-subtle">preview.your-project.com</span></div>
              <div className="mt-3 grid min-h-52 place-items-center rounded-lg bg-gradient-to-br from-[#1d3557] via-[#293b72] to-[#6d4c95] p-6 text-center">
                <div><span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] text-white/80">{t("Development preview")}</span><p className="mt-4 text-xl font-semibold text-white">{t("A clear version to validate.")}</p><p className="mt-2 text-xs text-white/65">{t("One link. The right feedback. No more screenshots in chat.")}</p></div>
              </div>
            </div>
            <div className="mt-3 flex gap-2"><span className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-muted">{t("Desktop")}</span><span className="rounded-lg px-3 py-2 text-xs text-subtle">{t("Tablet")}</span><span className="rounded-lg px-3 py-2 text-xs text-subtle">{t("Mobile")}</span></div>
          </div>
        </div>
      </section>

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
              [FileStack, "Files & previews", "Visual file manager and live website previews."],
              [CheckCircle2, "Approvals", "Versioned deliverables with full approval history."],
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
