import { ButtonLink } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getI18n, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Features");

const blocks = [
  { t: "Specification builder", d: "Structure every project as phases, milestones, tasks, subtasks and deliverables. Reorder by drag and drop, set weights, deadlines, dependencies, checklists, estimates and costs. Start from a template or from scratch." },
  { t: "A progress engine you can trust", d: "Automatic weighted progress (Σ phase progress × phase weight) or a manual override when you need it. Built on facts: overdue tasks, approvals waiting, unpaid invoices." },
  { t: "Team workload", d: "Each person's planned hours against their weekly capacity, six weeks ahead: overdue and due-this-week tasks, absences, part-time. Unassigned tasks get a suggested owner based on free time and project access." },
  { t: "Project health & portfolio", d: "One page to steer every project: a transparent score with the reasons behind it — delay versus expected progress, budget consumed and overrun forecast, client approvals blocking you, margin and next deadlines. Group by client or project manager." },
  { t: "The client portal", d: "Your client opens one link and understands everything in five seconds: percentage complete, current stage, what's waiting for them, the latest update, files and invoices. Built mobile-first." },
  { t: "Deliverables & approvals", d: "Submit versioned deliverables, request approval, and keep an immutable history: Homepage V1 — changes requested, Homepage V2 — approved, with who, when and why." },
  { t: "Files & previews", d: "A visual file manager shared with your client in real time, one-tap sharing, 30-day restore of deleted files. Link Google Drive files without duplicating them. See the client's website in desktop and mobile — live, or as a full-page capture for sites that block embedding." },
  { t: "Client change requests", d: "Your client picks the topic and the concerned page and describes the change. The people in charge of the project are notified in the app and by email, and can turn it into a task in one click." },
  { t: "Share access your way", d: "Invite clients by email, send a private access link by WhatsApp with a pre-filled message, or share a link through any app. No email address needed." },
  { t: "Invoices & online payments", d: "Create invoices with automatic, server-side totals and transactional numbering. Send by email with the PDF attached, get paid by card through your own Stripe account, record manual and partial payments, send reminders automatically." },
  { t: "Notifications that matter", d: "Actionable in-app notifications and emails for approvals, payments, overdue invoices and assignments — with per-topic preferences." },
  { t: "Team & permissions", d: "Invite developers, designers and freelancers with granular per-project permissions: tasks, files, client details, finance, invoices and messages." },
];

export default async function Features() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("How it works")}</h1>
      <p className="mt-4 max-w-2xl text-muted">{t("Specification → Execution → Progress → Documents → Deliverables → Client approval → Invoice → Payment. One product, one client experience.")}</p>
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        {blocks.map((b, i) => (
          <div key={b.t} className="bg-bg p-7">
            <div className="num text-xs text-subtle">{String(i + 1).padStart(2, "0")}</div>
            <h2 className="mt-3 text-lg font-medium">{t(b.t)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(b.d)}</p>
          </div>
        ))}
      </div>
      <div className="mt-14 text-center">
        <ButtonLink href="/signup" variant="primary" size="lg">Start free <ArrowRight className="size-4" /></ButtonLink>
      </div>
    </div>
  );
}
