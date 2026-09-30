import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { Section } from "@/components/ui/primitives";
import { ProjectSettingsForm } from "@/components/app/project-forms";
import { ProjectMembers } from "@/components/app/team-forms";

export default async function ProjectSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, project, perms } = await loadProject(id);
  if (!hasLevel(perms, "projects", "manage")) notFound();
  const [clients, members, projectMembers] = await Promise.all([
    db.client.findMany({ where: { workspaceId: ctx.workspace.id, OR: [{ archivedAt: null }, { id: project.clientId }] }, orderBy: { company: "asc" } }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id, status: "ACTIVE" }, include: { user: { select: { id: true, name: true, email: true } } } }),
    db.projectMember.findMany({ where: { projectId: id }, include: { member: { include: { user: { select: { name: true, email: true } } } } } }),
  ]);
  return (
    <div className="max-w-3xl space-y-12">
      <Section title="Project details">
        <div className="panel rounded-2xl p-5">
          <ProjectSettingsForm
            clients={clients.map((c) => ({ id: c.id, name: c.company || `${c.firstName} ${c.lastName}` }))}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
            v={{ ...project, status: project.status }}
          />
        </div>
      </Section>
      <Section title="Project team" description="Owners, admins and members with access to all projects are always included. Add collaborators and optionally restrict their permissions on this project.">
        <ProjectMembers
          projectId={id}
          candidates={members.filter((m) => !["OWNER", "ADMIN"].includes(m.role) && !m.allProjects && !projectMembers.some((pm) => pm.memberId === m.id)).map((m) => ({ id: m.id, name: m.user.name, role: m.role }))}
          members={projectMembers.map((pm) => ({ id: pm.id, name: pm.member.user.name, email: pm.member.user.email, role: pm.member.role, permissions: (pm.permissions ?? {}) as Record<string, string> }))}
        />
      </Section>
    </div>
  );
}
