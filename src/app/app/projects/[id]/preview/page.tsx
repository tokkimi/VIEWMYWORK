import { MonitorSmartphone, Link2 } from "lucide-react";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { EmptyState, Section, Badge } from "@/components/ui/primitives";
import { PreviewFrame } from "@/components/preview-frame";
import { AddPreviewDialog, PreviewItemActions, AddLinkDialog, DeleteLinkButton } from "@/components/app/preview-forms";
import { fmtDateTime } from "@/lib/format";

export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { perms } = await loadProject(id);
  const [previews, links] = await Promise.all([db.preview.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } }), db.projectLink.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } })]);
  const canEdit = hasLevel(perms, "projects", "edit");
  return (
    <div className="space-y-10">
      <Section title="Live previews" description="Websites, apps and prototypes your client can open from their portal." action={canEdit ? <AddPreviewDialog projectId={id} /> : undefined}>
        {previews.length === 0 ? (
          <EmptyState icon={<MonitorSmartphone />} title="No previews yet" description="Add a staging URL or prototype link. We'll show it in a device frame — or a clean preview card when the site blocks embedding." />
        ) : (
          <div className="space-y-10">
            {previews.map((p) => (
              <div key={p.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><h3 className="text-sm font-medium">{p.label}</h3><Badge>{p.type.replace("_", " ").toLowerCase()}</Badge>{p.visibility === "INTERNAL" && <Badge>Internal</Badge>}{p.embeddable === false && <Badge tone="warning">Embedding blocked by site</Badge>}</div>
                  {canEdit && <div className="flex items-center gap-2"><span className="text-[11px] text-subtle">checked {fmtDateTime(p.checkedAt)}</span><PreviewItemActions id={p.id} /></div>}
                </div>
                <PreviewFrame p={{ id: p.id, label: p.label, url: p.url, type: p.type, embeddable: p.embeddable, pageTitle: p.pageTitle, imageUrl: p.imageUrl }} />
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Links" action={canEdit ? <AddLinkDialog projectId={id} /> : undefined}>
        {links.length === 0 ? <p className="text-sm text-subtle">No links yet.</p> : (
          <ul className="panel divide-y divide-line rounded-2xl">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Link2 className="size-4 text-subtle" />
                <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate hover:underline">{l.label} <span className="text-subtle">— {l.url}</span></a>
                {l.visibility === "INTERNAL" ? <Badge>Internal</Badge> : <Badge tone="accent">Client</Badge>}
                {canEdit && <DeleteLinkButton id={l.id} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
