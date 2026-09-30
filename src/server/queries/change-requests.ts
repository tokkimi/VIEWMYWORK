import { db } from "@/lib/db";

/** Pages a client can pick: the project's page list, then its client-visible deliverables. */
export async function selectablePages(projectId: string, pages: string[]) {
  const deliverables = await db.deliverable.findMany({ where: { projectId, visibility: "CLIENT_VISIBLE" }, select: { title: true }, orderBy: { createdAt: "asc" } });
  return [...new Set([...pages, ...deliverables.map((d) => d.title)])];
}
