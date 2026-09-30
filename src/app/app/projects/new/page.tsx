import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { NewProjectForm } from "@/components/app/project-forms";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("New project");

export default async function NewProject({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "projects", "manage");
  const sp = await searchParams;
  const [clients, members, templates] = await Promise.all([
    db.client.findMany({ where: { workspaceId: ctx.workspace.id, archivedAt: null }, orderBy: { company: "asc" } }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "PROJECT_MANAGER"] } }, include: { user: { select: { id: true, name: true } } } }),
    db.projectTemplate.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: ctx.workspace.id }] }, include: { phases: { select: { id: true } } }, orderBy: [{ workspaceId: { sort: "desc", nulls: "last" } }, { name: "asc" }] }),
  ]);
  if (!clients.length)
    return (
      <>
        <PageHeader title="New project" />
        <EmptyState icon={<Users />} title="Add a client first" description="Every project belongs to a client — that's who the portal is for." action={<ButtonLink href="/app/clients/new" variant="primary"><Tr>Add client</Tr></ButtonLink>} />
      </>
    );
  return (
    <div className="max-w-3xl">
      <PageHeader title="New project" eyebrow="Projects" />
      <NewProjectForm
        clients={clients.map((c) => ({ id: c.id, name: c.company || `${c.firstName} ${c.lastName}` }))}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
        templates={templates.map((t) => ({ id: t.id, name: t.name, phases: t.phases.length }))}
        v={{ clientId: sp.clientId && clients.some((c) => c.id === sp.clientId) ? sp.clientId : clients[0].id, managerId: ctx.user.id, currency: ctx.workspace.defaultCurrency }}
      />
    </div>
  );
}
