"use client";

import { useState } from "react";
import { UserPlus, Pencil, Trash2, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Select, Submit, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useActionButton } from "./invoice-actions";
import { inviteMemberAction, updateMemberAction, removeMemberAction, revokeInvitationAction, addProjectMemberAction, updateProjectMemberAction, removeProjectMemberAction } from "@/server/actions/team";
import { CAPABILITIES, ROLE_DEFAULTS, ROLE_LABELS } from "@/lib/auth/permissions";
import type { WorkspaceRole } from "@prisma/client";

const CAP_LABELS: Record<string, string> = { projects: "Projects", tasks: "Tasks", files: "Files", clients: "Client details", messages: "Client messages", invoices: "Invoices", finance: "Finance", team: "Team", settings: "Settings" };

/** Per-capability override editor. “Role default” keeps the role's level. */
export function PermissionEditor({ role, value = {}, only }: { role: WorkspaceRole; value?: Record<string, string>; only?: string[] }) {
  const caps = Object.entries(CAPABILITIES).filter(([k]) => !only || only.includes(k));
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-sm">
        <tbody>
          {caps.map(([cap, levels]) => (
            <tr key={cap} className="border-b border-line last:border-0">
              <td className="px-3 py-2 text-muted">{CAP_LABELS[cap]}</td>
              <td className="px-2 py-1.5">
                <select name={`perm_${cap}`} defaultValue={value[cap] ?? "default"} aria-label={`${CAP_LABELS[cap]} permission`} className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[13px]">
                  <option value="default">Role default ({ROLE_DEFAULTS[role][cap as keyof (typeof ROLE_DEFAULTS)["OWNER"]]})</option>
                  {(levels as readonly string[]).map((l) => <option key={l} value={l}>{l === "none" ? "No access" : l[0].toUpperCase() + l.slice(1)}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InviteMemberDialog({ projects, isOwner }: { projects: { id: string; name: string }[]; isOwner: boolean }) {
  const [role, setRole] = useState<WorkspaceRole>("COLLABORATOR");
  const [res, setRes] = useState<{ link: string; emailStatus: string } | null>(null);
  return (
    <Dialog size="lg" title="Invite a team member" trigger={(open) => <Button variant="primary" onClick={() => { setRes(null); open(); }}><UserPlus className="size-4" />Invite</Button>}>
      {(close) =>
        res ? (
          <div className="space-y-4 text-sm">
            {res.emailStatus === "SENT" ? <p>Invitation sent. It expires in 7 days.</p> : <p className="rounded-lg bg-warning-soft p-3 text-warning">Invitation created, but <strong>no email was sent</strong> (email delivery not configured). Share this link:</p>}
            <div className="flex items-center gap-2 rounded-lg border border-line p-2"><code className="min-w-0 flex-1 truncate text-xs">{res.link}</code><CopyButton value={res.link} label="Copy" /></div>
            <div className="flex justify-end"><Button onClick={close}>Done</Button></div>
          </div>
        ) : (
          <Form action={inviteMemberAction} onSuccess={(d) => setRes(d as { link: string; emailStatus: string })} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" name="email"><Input name="email" type="email" required /></Field>
              <Field label="Title" name="title" optional><Input name="title" placeholder="Developer, Designer…" /></Field>
              <Field label="Role" name="role">
                <Select name="role" value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
                  {isOwner && <option value="ADMIN">Admin</option>}
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="COLLABORATOR">Collaborator</option>
                  <option value="VIEWER">Viewer</option>
                </Select>
              </Field>
              <div className="flex items-end pb-2"><Checkbox name="allProjects" label="Access to all projects" /></div>
            </div>
            {projects.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium">Projects</legend>
                <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
                  {projects.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="projectIds" value={p.id} className="accent-[#4d7cfe]" />{p.name}</label>)}
                </div>
              </fieldset>
            )}
            <div>
              <div className="mb-2 text-[13px] font-medium">Permissions</div>
              <PermissionEditor role={role} key={role} />
            </div>
            <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Send invitation</Submit></div>
          </Form>
        )
      }
    </Dialog>
  );
}

export function EditMemberDialog({ m, isOwner }: { m: { id: string; name: string; role: WorkspaceRole; title: string | null; allProjects: boolean; permissions: Record<string, string> }; isOwner: boolean }) {
  const [role, setRole] = useState<WorkspaceRole>(m.role);
  return (
    <Dialog size="lg" title={`Edit ${m.name}`} trigger={(open) => <button onClick={open} aria-label={`Edit ${m.name}`} className="rounded p-1.5 text-muted hover:text-fg"><Pencil className="size-3.5" /></button>}>
      {(close) => (
        <Form action={updateMemberAction} onSuccess={close} className="space-y-5">
          <input type="hidden" name="memberId" value={m.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" name="role">
              <Select name="role" value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
                {(isOwner || m.role === "ADMIN") && <option value="ADMIN">Admin</option>}
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="COLLABORATOR">Collaborator</option>
                <option value="VIEWER">Viewer</option>
              </Select>
            </Field>
            <Field label="Title" name="title" optional><Input name="title" defaultValue={m.title ?? ""} /></Field>
          </div>
          <Checkbox name="allProjects" label="Access to all projects" defaultChecked={m.allProjects} />
          <PermissionEditor role={role} value={m.permissions} key={role} />
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Save</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}

export function RemoveMemberButton({ id, name }: { id: string; name: string }) {
  const { pending, run } = useActionButton();
  return <button aria-label={`Remove ${name}`} disabled={pending} onClick={() => confirm(`Remove ${name} from the workspace?`) && run(() => removeMemberAction(id))} className="rounded p-1.5 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>;
}

export function RevokeInvitationButton({ id }: { id: string }) {
  const { pending, run } = useActionButton();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeInvitationAction(id))}>Revoke</Button>;
}

const PROJECT_CAPS = ["tasks", "files", "clients", "messages", "invoices", "finance"];

export function ProjectMembers({ projectId, candidates, members }: { projectId: string; candidates: { id: string; name: string; role: WorkspaceRole }[]; members: { id: string; name: string; email: string; role: WorkspaceRole; permissions: Record<string, string> }[] }) {
  const { pending, run } = useActionButton();
  return (
    <div className="space-y-4">
      {members.length === 0 ? <p className="text-sm text-subtle">No project-specific collaborators.</p> : (
        <ul className="panel divide-y divide-line rounded-2xl">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><div className="truncate">{m.name}</div><div className="truncate text-xs text-muted">{ROLE_LABELS[m.role]} · {Object.keys(m.permissions).length ? "Custom project permissions" : "Role defaults"}</div></div>
              <Dialog size="lg" title={`${m.name} on this project`} trigger={(open) => <Button size="sm" variant="ghost" onClick={open}>Permissions</Button>}>
                {(close) => (
                  <Form action={updateProjectMemberAction} onSuccess={close} className="space-y-4">
                    <input type="hidden" name="id" value={m.id} />
                    <PermissionEditor role={m.role} value={m.permissions} only={PROJECT_CAPS} />
                    <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Save</Submit></div>
                  </Form>
                )}
              </Dialog>
              <button aria-label={`Remove ${m.name}`} disabled={pending} onClick={() => run(() => removeProjectMemberAction(m.id))} className="rounded p-1.5 text-subtle hover:text-danger"><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <Form action={addProjectMemberAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Add collaborator" name="memberId" className="min-w-56 flex-1"><Select name="memberId">{candidates.map((c) => <option key={c.id} value={c.id}>{c.name} — {ROLE_LABELS[c.role]}</option>)}</Select></Field>
          <Submit variant="secondary"><Plus className="size-3.5" />Add</Submit>
        </Form>
      )}
    </div>
  );
}
