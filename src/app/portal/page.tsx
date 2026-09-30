import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal, portalProjectWhere } from "@/lib/auth/portal";
import { portalProjectHome, waitingForClient } from "@/server/queries/portal";
import { PortalProjectHome, WaitingForYou } from "@/components/portal/project-home";
import { ProgressBar, EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "Overview" };

export default async function PortalHome() {
  const ctx = await requirePortal();
  const projects = await db.project.findMany({ where: portalProjectWhere(ctx), include: { phases: { where: { visibility: "CLIENT_VISIBLE" }, orderBy: { position: "asc" }, select: { title: true, status: true } } }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });
  const waiting = await waitingForClient(ctx.workspace.id, ctx.client.id, projects.map((p) => p.id));
  const active = projects.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED");

  if (projects.length === 0)
    return (
      <>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Welcome, {ctx.user.name.split(" ")[0]}</h1>
        <WaitingForYou items={waiting} />
        <EmptyState className="mt-8" icon={<FolderKanban />} title="No projects shared yet" description={`${ctx.workspace.name} hasn't shared a project with you yet. You'll be notified when they do.`} />
      </>
    );

  const focus = active.length === 1 ? active[0] : projects.length === 1 ? projects[0] : null;
  if (focus) {
    const home = await portalProjectHome(focus.id);
    return (
      <>
        <div className="eyebrow mb-1">Project</div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{focus.name}</h1>
        <div className="mt-6"><PortalProjectHome project={focus} home={home} waiting={waiting} base="/portal" /></div>
      </>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight">Hello, {ctx.user.name.split(" ")[0]}</h1>
      <WaitingForYou items={waiting} />
      <section>
        <h2 className="mb-3 text-[13px] font-semibold">Your projects</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const current = p.phases.find((x) => x.status !== "COMPLETED");
            return (
              <li key={p.id}>
                <Link href={`/portal/projects/${p.id}`} className="glass block rounded-2xl p-5 hover:border-line-strong">
                  <div className="text-[15px] font-medium">{p.name}</div>
                  <div className="mt-4 flex items-end justify-between"><span className="num text-3xl font-semibold">{p.progress}%</span><span className="text-xs text-muted">{p.status === "COMPLETED" ? "Completed" : current ? current.title : ""}</span></div>
                  <ProgressBar value={p.progress} className="mt-2" label={`${p.name} progress`} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
