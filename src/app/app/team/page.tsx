import { UsersRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace, requirePerm, can, projectScope } from "@/lib/auth/context";
import { PageHeader, Section, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { InviteMemberDialog, EditMemberDialog, RemoveMemberButton, RevokeInvitationButton } from "@/components/app/team-forms";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getWorkspacePlan } from "@/lib/plans";
import { fmtDate, relativeTime } from "@/lib/format";

export const metadata = { title: "Team" };

export default async function Team() {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "team", "view");
  const manage = can(ctx, "team", "manage");
  const [members, invitations, projects, plan] = await Promise.all([
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id }, include: { user: { select: { name: true, email: true, avatarUrl: true, lastActiveAt: true } }, projectMemberships: { include: { project: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } }),
    manage ? db.invitation.findMany({ where: { workspaceId: ctx.workspace.id, kind: "MEMBER", acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    db.project.findMany({ where: { ...projectScope(ctx), archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getWorkspacePlan(ctx.workspace.id),
  ]);
  const seats = plan?.plan.collaboratorLimit;
  const used = members.filter((m) => m.role !== "OWNER").length + invitations.length;

  return (
    <>
      <PageHeader
        title="Team"
        description={seats === null || seats === undefined ? `${used} collaborator${used === 1 ? "" : "s"}` : `${used} of ${seats} collaborator seat${seats === 1 ? "" : "s"} used`}
        actions={manage ? <InviteMemberDialog projects={projects} isOwner={ctx.member.role === "OWNER"} /> : undefined}
      />
      {seats === 0 && manage && <p className="mb-6 rounded-xl border border-line px-4 py-3 text-sm text-muted">Your {plan?.plan.name} plan is a solo workspace. Upgrade in Settings → Billing to invite collaborators.</p>}
      <div className="panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-left text-[11.5px] uppercase tracking-wide text-subtle"><th className="border-b border-line px-4 py-2.5 font-medium">Member</th><th className="border-b border-line px-4 py-2.5 font-medium">Role</th><th className="border-b border-line px-4 py-2.5 font-medium">Projects</th><th className="border-b border-line px-4 py-2.5 font-medium">Status</th><th className="border-b border-line px-4 py-2.5" /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={m.user.name} src={m.user.avatarUrl} size={30} /><div className="min-w-0"><div className="truncate">{m.user.name}{m.userId === ctx.user.id && <span className="text-subtle"> (you)</span>}</div><div className="truncate text-xs text-muted">{m.user.email}</div></div></div></td>
                <td className="px-4 py-3"><div>{ROLE_LABELS[m.role]}</div>{m.title && <div className="text-xs text-muted">{m.title}</div>}</td>
                <td className="px-4 py-3 text-muted">{m.role === "OWNER" || m.role === "ADMIN" || m.allProjects ? "All projects" : m.projectMemberships.map((p) => p.project.name).join(", ") || "—"}</td>
                <td className="px-4 py-3">{m.status === "ACTIVE" ? <span className="text-xs text-subtle">{m.user.lastActiveAt ? `Active ${relativeTime(m.user.lastActiveAt)}` : "Active"}</span> : <Badge tone="warning">Suspended</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  {manage && m.role !== "OWNER" && m.userId !== ctx.user.id && (
                    <div className="flex justify-end gap-1">
                      <EditMemberDialog m={{ id: m.id, name: m.user.name, role: m.role, title: m.title, allProjects: m.allProjects, permissions: (m.permissions ?? {}) as Record<string, string> }} isOwner={ctx.member.role === "OWNER"} />
                      <RemoveMemberButton id={m.id} name={m.user.name} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {manage && (
        <Section title="Pending invitations" className="mt-10">
          {invitations.length === 0 ? <EmptyState icon={<UsersRound />} title="No pending invitations" /> : (
            <ul className="panel divide-y divide-line rounded-2xl">
              {invitations.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1"><div className="truncate">{i.email}</div><div className="text-xs text-muted">{i.role ? ROLE_LABELS[i.role] : ""} · expires {fmtDate(i.expiresAt)}</div></div>
                  <RevokeInvitationButton id={i.id} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}
