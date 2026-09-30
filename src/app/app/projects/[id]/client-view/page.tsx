import { Eye } from "lucide-react";
import { loadProject } from "@/server/queries/project";
import { portalProjectHome, waitingForClient } from "@/server/queries/portal";
import { PortalProjectHome } from "@/components/portal/project-home";
import { Tr } from "@/lib/i18n/client";

/** Renders the client portal for this project using the exact same client-visibility queries. */
export default async function ClientViewPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, project } = await loadProject(id);
  const [home, waiting] = await Promise.all([portalProjectHome(id), waitingForClient(ctx.workspace.id, project.clientId, [id], "/portal")]);
  return (
    <div>
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-2.5 text-sm"><Eye className="size-4 text-accent" /><Tr>Client portal preview — internal tasks, notes and finances are not shown.</Tr>{!project.portalEnabled && <span className="text-warning"> <Tr>This project is currently hidden from the portal.</Tr></span>}</div>
      <div className="mx-auto max-w-5xl rounded-3xl border border-line bg-bg p-5 sm:p-8">
        <div className="eyebrow mb-1">{project.name}</div>
        <PortalProjectHome project={project} home={home} waiting={waiting} base="/portal" preview />
      </div>
    </div>
  );
}
