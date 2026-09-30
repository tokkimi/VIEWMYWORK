import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { portalProjectHome } from "@/server/queries/portal";
import { ClientTimeline } from "@/components/portal/project-home";
import { ProgressBar } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Project plan" };

export default async function PortalPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePortal();
  const project = await getPortalProject(ctx, id);
  const home = await portalProjectHome(id);
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="flex items-end justify-between"><span className="num text-4xl font-semibold">{project.progress}%</span>{project.targetDate && <span className="text-sm text-muted">Target {fmtDate(project.targetDate)}</span>}</div>
        <ProgressBar value={project.progress} size="lg" className="mt-3" label="Project progress" />
      </div>
      <ClientTimeline phases={home.phases} />
      {home.updates.length > 1 && (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold">All updates</h2>
          <ol className="space-y-3">
            {home.updates.map((u) => (
              <li key={u.id} className="panel rounded-2xl p-4">
                <div className="text-xs text-subtle">{fmtDate(u.publishedAt)}</div>
                {u.title && <div className="mt-1 font-medium">{u.title}</div>}
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{u.body}</p>
                {u.nextSteps && <p className="mt-2 text-sm"><span className="text-subtle">Next: </span>{u.nextSteps}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
