import Link from "next/link";
import { Suspense } from "react";
import { Plus, FolderKanban } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspace, projectScope, can } from "@/lib/auth/context";
import { PageHeader, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { ProjectStatusBadge } from "@/components/status";
import { PhaseTimeline } from "@/components/app/blocks";
import { fmtShortDate, daysBetween } from "@/lib/format";

export const metadata = { title: "Projects" };

export default async function Projects({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const view = sp.view ?? "active";
  const where: Prisma.ProjectWhereInput = { ...projectScope(ctx) };
  if (view === "active") Object.assign(where, { archivedAt: null, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } });
  if (view === "completed") Object.assign(where, { archivedAt: null, status: { in: ["COMPLETED", "CANCELLED"] } });
  if (view === "archived") Object.assign(where, { archivedAt: { not: null } });
  if (sp.q) where.name = { contains: sp.q, mode: "insensitive" };
  const now = new Date();
  const projects = await db.project.findMany({
    where,
    include: {
      client: true,
      phases: { orderBy: { position: "asc" }, select: { id: true, title: true, status: true, progress: true } },
      _count: { select: { tasks: { where: { deadline: { lt: now }, status: { not: "COMPLETED" } } }, waits: { where: { resolvedAt: null } } } },
    },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: 200,
  });

  return (
    <>
      <PageHeader title="Projects" actions={can(ctx, "projects", "manage") ? <ButtonLink href="/app/projects/new" variant="primary"><Plus className="size-4" />New project</ButtonLink> : undefined} />
      <Suspense>
        <LinkTabs exact tabs={[{ href: "/app/projects", label: "Active" }, { href: "/app/projects?view=completed", label: "Completed" }, { href: "/app/projects?view=archived", label: "Archived" }, { href: "/app/projects?view=all", label: "All" }]} />
      </Suspense>
      {projects.length === 0 ? (
        <EmptyState icon={<FolderKanban />} title={view === "active" ? "No active projects" : "Nothing here"} description={view === "active" ? "Create a project, build its specification and give your client a portal to follow it." : undefined} action={view === "active" && can(ctx, "projects", "manage") ? <ButtonLink href="/app/projects/new" variant="primary">New project</ButtonLink> : undefined} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {projects.map((p) => {
            const current = p.phases.find((x) => x.status !== "COMPLETED");
            const left = p.targetDate ? daysBetween(now, p.targetDate) : null;
            const facts = [p._count.tasks ? `${p._count.tasks} overdue` : null, p._count.waits ? `${p._count.waits} waiting on client` : null].filter(Boolean);
            return (
              <li key={p.id}>
                <Link href={`/app/projects/${p.id}`} className="glass group flex h-full flex-col rounded-2xl p-5 transition-colors hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted">{p.client.company || `${p.client.firstName} ${p.client.lastName}`}{p.type ? ` · ${p.type}` : ""}</div>
                    </div>
                    <ProjectStatusBadge s={p.status} />
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <span className="num text-3xl font-semibold tracking-tight">{p.progress}%</span>
                    <span className="text-xs text-muted">{current ? <>Now: <span className="text-fg">{current.title}</span></> : p.phases.length ? "All phases done" : "No phases yet"}</span>
                  </div>
                  <ProgressBar value={p.progress} className="mt-2" label={`${p.name} progress`} />
                  {p.phases.length > 1 && <div className="mt-4"><PhaseTimeline phases={p.phases} compact /></div>}
                  <div className="mt-auto flex items-center justify-between pt-5 text-xs">
                    <span className={facts.length ? "text-warning" : "text-subtle"}>{facts.join(" · ") || "On track"}</span>
                    {p.targetDate && <span className={left !== null && left < 0 && p.status !== "COMPLETED" ? "text-danger" : "text-subtle"}>{p.status === "COMPLETED" ? "Completed" : left !== null && left < 0 ? `${-left}d late` : `Due ${fmtShortDate(p.targetDate)}`}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
