import { LiveSync } from "@/components/live-sync";
import { db } from "@/lib/db";
import Link from "next/link";
import { Suspense } from "react";
import { Eye, Plus, Upload, Package } from "lucide-react";
import { loadProject } from "@/server/queries/project";
import { hasLevel } from "@/lib/auth/permissions";
import { ProgressBar, Badge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { ProjectStatusBadge } from "@/components/status";
import { InviteToPortalDialog } from "@/components/app/client-form";
import { ProjectMoreMenu } from "@/components/app/project-menu";
import { daysBetween } from "@/lib/format";
import { Tr } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  const { id } = await params;
  const { ctx, project, perms } = await loadProject(id);
  const base = `/app/projects/${id}`;
  const clientName = project.client.company || `${project.client.firstName} ${project.client.lastName}`;
  const left = project.targetDate ? daysBetween(new Date(), project.targetDate) : null;
  const current = project.phases.find((p) => p.status !== "COMPLETED");
  const openRequests = await db.changeRequest.count({ where: { projectId: project.id, status: { in: ["OPEN", "IN_PROGRESS"] } } });

  return (
    <>
      <LiveSync project={id} />
      <div className="mb-6">
        <div className="eyebrow mb-2 flex items-center gap-2"><Link href="/app/projects" className="hover:text-fg"><Tr>Projects</Tr></Link><span>/</span><Link href={`/app/clients/${project.clientId}`} className="truncate hover:text-fg">{clientName}</Link></div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[28px]">{project.name}</h1>
              <ProjectStatusBadge s={project.status} />
              {project.archivedAt && <Badge><Tr>Archived</Tr></Badge>}
              {!project.portalEnabled && <Badge><Tr>Portal hidden</Tr></Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted">
              <span>{current ? <><Tr>Currently in</Tr> <span className="text-fg">{current.title}</span></> : project.phases.length ? t("All phases complete") : t("No specification yet")}</span>
              {project.targetDate && <span><Tr>Target</Tr> {fmt.date(project.targetDate)}{left !== null && project.status !== "COMPLETED" && <span className={left < 0 ? "text-danger" : ""}> · {left < 0 ? t("{n}d late", { n: -left }) : t("{n}d left", { n: left })}</span>}</span>}
              {project.manager && <span><Tr>PM</Tr> {project.manager.name}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`${base}/client-view`}><Eye className="size-4" /><Tr>Preview portal</Tr></ButtonLink>
            {hasLevel(ctx.perms, "clients", "edit") && <InviteToPortalDialog clientId={project.clientId} email={project.client.email} phone={project.client.phone} projectId={id} label="Share portal" />}
            {hasLevel(perms, "tasks", "edit") && <ButtonLink href={`${base}/tasks?new=1`}><Plus className="size-4" /><Tr>Task</Tr></ButtonLink>}
            {hasLevel(perms, "projects", "edit") && <ButtonLink href={`${base}/deliverables?new=1`}><Package className="size-4" /><Tr>Deliverable</Tr></ButtonLink>}
            {hasLevel(perms, "files", "upload") && <ButtonLink href={`${base}/files`}><Upload className="size-4" /><Tr>Upload</Tr></ButtonLink>}
            {hasLevel(perms, "projects", "manage") && <ProjectMoreMenu projectId={id} name={project.name} status={project.status} archived={Boolean(project.archivedAt)} />}
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <span className="num text-sm font-medium">{project.progress}%</span>
          <ProgressBar value={project.progress} size="md" label="Project progress" />
          {project.progressMode === "MANUAL" && <Badge><Tr>Manual</Tr></Badge>}
        </div>
      </div>
      <Suspense>
        <LinkTabs
          tabs={[
            { href: base, label: "Overview" },
            { href: `${base}/specification`, label: "Specification" },
            { href: `${base}/tasks`, label: "Tasks" },
            { href: `${base}/files`, label: "Files" },
            { href: `${base}/deliverables`, label: "Deliverables" },
            { href: `${base}/preview`, label: "Preview" },
            { href: `${base}/requests`, label: "Change requests", count: openRequests },
            { href: `${base}/messages`, label: "Messages" },
            ...(hasLevel(perms, "invoices", "view") ? [{ href: `${base}/invoices`, label: "Invoices" }] : []),
            ...(hasLevel(perms, "finance", "view") ? [{ href: `${base}/finance`, label: "Finance" }] : []),
            { href: `${base}/activity`, label: "Activity" },
            ...(hasLevel(perms, "projects", "manage") ? [{ href: `${base}/settings`, label: "Settings" }] : []),
          ]}
        />
      </Suspense>
      {children}
    </>
  );
}
