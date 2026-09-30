import { MessageSquareDiff } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { Badge, EmptyState, Section } from "@/components/ui/primitives";
import { ChangeRequestReply, ProjectPagesForm } from "@/components/change-requests";
import { CHANGE_SUBJECTS, CHANGE_REQUEST_STATUS, type ChangeSubject } from "@/lib/labels";
import { getI18n, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Change requests");

export default async function ProjectChangeRequests({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  const { id } = await params;
  const { project, perms } = await loadProject(id);
  const canEdit = hasLevel(perms, "projects", "edit");
  const requests = await db.changeRequest.findMany({ where: { projectId: project.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });
  const open = requests.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");
  const closed = requests.filter((r) => r.status === "DONE" || r.status === "DECLINED");
  const card = (r: (typeof requests)[number]) => (
    <li key={r.id} id={r.id} className="panel scroll-mt-24 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{t(CHANGE_SUBJECTS[r.subject as ChangeSubject] ?? r.subject)}{r.page && <span className="text-muted"> · {r.page}</span>}</div>
        <Badge tone={CHANGE_REQUEST_STATUS[r.status].tone}>{CHANGE_REQUEST_STATUS[r.status].label}</Badge>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{r.message}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-subtle">
        <span>{r.authorName} · {fmt.dateTime(r.createdAt)}</span>
        {r.taskId && <Link href={`/app/projects/${project.id}/tasks?task=${r.taskId}`} className="text-accent hover:underline">{t("Linked task")}</Link>}
      </div>
      {canEdit ? <ChangeRequestReply id={r.id} status={r.status} response={r.response} hasTask={Boolean(r.taskId)} /> : r.response && <p className="mt-3 whitespace-pre-line rounded-xl border border-line p-3 text-sm text-muted">{r.response}</p>}
    </li>
  );
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-10">
        <Section title="Open requests" description="Change requests sent by your client from their portal.">
          {open.length === 0 ? <EmptyState icon={<MessageSquareDiff />} title="No open requests" description="When your client asks for a change, it shows up here and you're notified by email." /> : <ul className="space-y-3">{open.map(card)}</ul>}
        </Section>
        {closed.length > 0 && <Section title="Closed"><ul className="space-y-3">{closed.map(card)}</ul></Section>}
      </div>
      {canEdit && (
        <Section title="Pages" description="The client picks one of these when requesting a change. Client-visible deliverables are added automatically.">
          <div className="panel rounded-2xl p-5"><ProjectPagesForm projectId={project.id} pages={project.pages} /></div>
        </Section>
      )}
    </div>
  );
}
