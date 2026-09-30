import { db } from "@/lib/db";
import { loadProject } from "@/server/queries/project";
import { ActivityFeed } from "@/components/app/blocks";
import { Pagination } from "@/components/ui/pagination";

const PER = 50;

export default async function ProjectActivity({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { ctx } = await loadProject(id);
  const where = { workspaceId: ctx.workspace.id, projectId: id };
  const [total, items] = await Promise.all([db.activityLog.count({ where }), db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER })]);
  return (
    <div className="max-w-3xl">
      <div className="panel rounded-2xl"><ActivityFeed items={items} /></div>
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => `/app/projects/${id}/activity?page=${p}`} />
    </div>
  );
}
