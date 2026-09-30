import { uploadLimitMb } from "@/lib/storage";
import { Package, ExternalLink, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { EmptyState, Badge } from "@/components/ui/primitives";
import { DeliverableStatusBadge } from "@/components/status";
import { NewDeliverableDialog, DeliverableActions } from "@/components/app/deliverable-forms";
import { FileGrid } from "@/components/app/files";
import { Uploader } from "@/components/app/uploader";
import { toFileDTO } from "@/lib/file-dto";
import { integrations } from "@/lib/env";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

export default async function Deliverables({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { t, fmt } = await getI18n();
  const { id } = await params;
  const sp = await searchParams;
  const { project, perms } = await loadProject(id);
  const deliverables = await db.deliverable.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { versions: { orderBy: { version: "desc" }, include: { files: { where: { deletedAt: null, status: "READY" } } } }, approvals: { orderBy: { createdAt: "desc" } } },
  });
  const canEdit = hasLevel(perms, "projects", "edit");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted"><Tr>Versioned deliverables with a permanent approval history.</Tr></p>
        {canEdit && <NewDeliverableDialog projectId={id} phases={project.phases.map((p) => ({ id: p.id, title: p.title }))} openInitially={sp.new === "1"} />}
      </div>
      {deliverables.length === 0 ? (
        <EmptyState icon={<Package />} title="No deliverables yet" description="Submit designs, builds or documents for your client to review and approve." />
      ) : (
        <ul className="space-y-4">
          {deliverables.map((d) => {
            const current = d.versions[0];
            return (
              <li key={d.id} id={d.id} className="panel scroll-mt-24 rounded-2xl">
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-medium">{d.title}</h3>
                      <Badge>V{d.currentVersion}</Badge>
                      <DeliverableStatusBadge s={d.status} />
                      {d.visibility === "INTERNAL" && <Badge><Tr>Internal</Tr></Badge>}
                      {!d.requiresApproval && <Badge><Tr>No approval needed</Tr></Badge>}
                    </div>
                    {d.description && <p className="mt-1.5 max-w-2xl whitespace-pre-line text-sm text-muted">{d.description}</p>}
                    {current?.previewUrl && <a href={current.previewUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"><ExternalLink className="size-3.5" /><Tr>Preview link</Tr></a>}
                  </div>
                  {canEdit && <DeliverableActions d={{ id: d.id, title: d.title, description: d.description, status: d.status, requiresApproval: d.requiresApproval, internal: d.visibility === "INTERNAL", notes: current?.notes ?? null, previewUrl: current?.previewUrl ?? null }} />}
                </div>
                <div className="border-t border-line p-5">
                  {canEdit && current && d.status !== "APPROVED" && d.status !== "WAITING_FOR_CLIENT" && (
                    <div className="mb-4"><Uploader target={{ deliverableVersionId: current.id }} configured={integrations.storage()} maxMb={uploadLimitMb()} compact defaultVisibility="CLIENT_VISIBLE" category="DELIVERABLE" /></div>
                  )}
                  {current && current.files.length > 0 ? <FileGrid files={current.files.map(toFileDTO)} canManage={canEdit && d.status !== "APPROVED"} /> : <p className="text-sm text-subtle"><Tr>No files on V</Tr>{d.currentVersion}.</p>}
                </div>
                {(d.approvals.length > 0 || d.versions.length > 1) && (
                  <div className="border-t border-line p-5">
                    <h4 className="eyebrow mb-3"><Tr>Approval history</Tr></h4>
                    <ol className="space-y-3 border-l border-line pl-4 text-sm">
                      {d.versions.map((v) => {
                        const decisions = d.approvals.filter((a) => a.version === v.version);
                        return (
                          <li key={v.id}>
                            <div className="font-medium">{d.title} V{v.version}{v.submittedAt ? <span className="font-normal text-subtle"> <Tr>· submitted</Tr> {fmt.dateTime(v.submittedAt)}</span> : <span className="font-normal text-subtle"> <Tr>· not submitted</Tr></span>}</div>
                            {v.notes && <p className="text-xs text-muted">{v.notes}</p>}
                            {decisions.map((a) => (
                              <div key={a.id} className="mt-1.5 flex gap-2">
                                {a.decision === "APPROVED" ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <MessageSquareWarning className="mt-0.5 size-4 text-danger" />}
                                <div>
                                  <div className={a.decision === "APPROVED" ? "text-success" : "text-danger"}>{a.decision === "APPROVED" ? t("Approved") : t("Changes requested")} <span className="text-subtle"><Tr>by</Tr> {a.userName} · {fmt.dateTime(a.createdAt)}</span></div>
                                  {a.comment && <p className="mt-0.5 whitespace-pre-line text-muted">“{a.comment}”</p>}
                                </div>
                              </div>
                            ))}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
