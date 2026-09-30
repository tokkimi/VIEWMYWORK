import { MessageSquareDiff } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { Badge, EmptyState, Section } from "@/components/ui/primitives";
import { ChangeRequestForm } from "@/components/change-requests";
import { selectablePages } from "@/server/queries/change-requests";
import { CHANGE_SUBJECTS, CHANGE_REQUEST_STATUS, type ChangeSubject } from "@/lib/labels";
import { getI18n, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Change requests");

export default async function PortalChangeRequests({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  const { id } = await params;
  const ctx = await requirePortal();
  const project = await getPortalProject(ctx, id);
  const [pages, requests] = await Promise.all([
    selectablePages(project.id, project.pages),
    db.changeRequest.findMany({ where: { projectId: project.id, clientId: ctx.client.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Section title="Request a change" description="Pick the subject and the page concerned, then describe what you'd like. The team is notified immediately.">
        <div className="panel rounded-2xl p-5"><ChangeRequestForm projectId={project.id} pages={pages} /></div>
      </Section>
      <Section title="Your requests">
        {requests.length === 0 ? (
          <EmptyState icon={<MessageSquareDiff />} title="No requests yet" description="Your change requests and the team's answers will appear here." />
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} id={r.id} className="panel scroll-mt-24 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{t(CHANGE_SUBJECTS[r.subject as ChangeSubject] ?? r.subject)}{r.page && <span className="text-muted"> · {r.page}</span>}</div>
                  <Badge tone={CHANGE_REQUEST_STATUS[r.status].tone}>{CHANGE_REQUEST_STATUS[r.status].label}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">{r.message}</p>
                <div className="mt-2 text-[11px] text-subtle">{r.authorName} · {fmt.dateTime(r.createdAt)}</div>
                {r.response && (
                  <div className="mt-3 rounded-xl border border-line bg-white/[0.02] p-3 text-sm">
                    <div className="eyebrow mb-1">{t("Answer from {workspace}", { workspace: ctx.workspace.name })}</div>
                    <p className="whitespace-pre-line">{r.response}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
