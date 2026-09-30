import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { portalProjectHome, waitingForClient } from "@/server/queries/portal";
import { PortalProjectHome } from "@/components/portal/project-home";

export default async function PortalProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePortal();
  const project = await getPortalProject(ctx, id);
  const [home, waiting] = await Promise.all([portalProjectHome(id), waitingForClient(ctx.workspace.id, ctx.client.id, [id])]);
  return <PortalProjectHome project={project} home={home} waiting={waiting} base="/portal" />;
}
