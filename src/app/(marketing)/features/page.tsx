import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Features" };

const blocks = [
  { t: "Specification builder", d: "Structure every project as phases, milestones, tasks, subtasks and deliverables. Reorder by drag and drop, set weights, deadlines, dependencies, checklists, estimates and costs. Start from a template or from scratch." },
  { t: "A progress engine you can trust", d: "Automatic weighted progress (Σ phase progress × phase weight) or a manual override when you need it. No mysterious health scores — just facts: overdue tasks, approvals waiting, unpaid invoices." },
  { t: "The client portal", d: "Your client opens one link and understands everything in five seconds: percentage complete, current stage, what's waiting for them, the latest update, files and invoices. Built mobile-first." },
  { t: "Deliverables & approvals", d: "Submit versioned deliverables, request approval, and keep an immutable history: Homepage V1 — changes requested, Homepage V2 — approved, with who, when and why." },
  { t: "Files & previews", d: "A visual file manager with image previews, signed private URLs and storage quotas. Link Google Drive files without duplicating them. Preview websites in desktop, tablet and mobile frames." },
  { t: "Invoices & online payments", d: "Create invoices with automatic, server-side totals and transactional numbering. Send by email with the PDF attached, get paid by card through your own Stripe account, record manual and partial payments, send reminders automatically." },
  { t: "Notifications that matter", d: "Actionable in-app notifications and emails for approvals, payments, overdue invoices and assignments — with per-topic preferences." },
  { t: "Team & permissions", d: "Invite developers, designers and freelancers with granular per-project permissions: tasks, files, client details, finance, invoices and messages." },
];

export default function Features() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">How it works</h1>
      <p className="mt-4 max-w-2xl text-muted">Specification → Execution → Progress → Documents → Deliverables → Client approval → Invoice → Payment. One product, one client experience.</p>
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        {blocks.map((b, i) => (
          <div key={b.t} className="bg-bg p-7">
            <div className="num text-xs text-subtle">{String(i + 1).padStart(2, "0")}</div>
            <h2 className="mt-3 text-lg font-medium">{b.t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{b.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-14 text-center">
        <ButtonLink href="/signup" variant="primary" size="lg">Start free <ArrowRight className="size-4" /></ButtonLink>
      </div>
    </div>
  );
}
