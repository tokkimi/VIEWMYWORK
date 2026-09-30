import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWorkspaceCtx, projectScope, can } from "@/lib/auth/context";

export async function GET(req: NextRequest) {
  const ctx = await getWorkspaceCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const contains = { contains: q, mode: "insensitive" as const };
  const ws = ctx.workspace.id;
  const scope = projectScope(ctx);

  const [projects, clients, tasks, invoices, files, deliverables] = await Promise.all([
    db.project.findMany({ where: { ...scope, name: contains }, take: 5, select: { id: true, name: true, client: { select: { company: true, firstName: true, lastName: true } } } }),
    can(ctx, "clients", "view") ? db.client.findMany({ where: { workspaceId: ws, OR: [{ firstName: contains }, { lastName: contains }, { company: contains }, { email: contains }] }, take: 5 }) : [],
    db.task.findMany({ where: { workspaceId: ws, project: scope, title: contains }, take: 5, select: { id: true, title: true, projectId: true, project: { select: { name: true } } } }),
    can(ctx, "invoices", "view") ? db.invoice.findMany({ where: { workspaceId: ws, OR: [{ number: contains }, { client: { company: contains } }, { client: { lastName: contains } }] }, take: 5, include: { client: true } }) : [],
    db.file.findMany({ where: { workspaceId: ws, deletedAt: null, name: contains, OR: [{ projectId: null }, { project: scope }] }, take: 5 }),
    db.deliverable.findMany({ where: { workspaceId: ws, project: scope, title: contains }, take: 5, select: { id: true, title: true, projectId: true, project: { select: { name: true } } } }),
  ]);

  const results = [
    ...projects.map((p) => ({ type: "project", id: p.id, title: p.name, subtitle: p.client.company || `${p.client.firstName} ${p.client.lastName}`, href: `/app/projects/${p.id}` })),
    ...clients.map((c) => ({ type: "client", id: c.id, title: c.company || `${c.firstName} ${c.lastName}`, subtitle: c.email, href: `/app/clients/${c.id}` })),
    ...tasks.map((t) => ({ type: "task", id: t.id, title: t.title, subtitle: t.project.name, href: `/app/projects/${t.projectId}/tasks?task=${t.id}` })),
    ...deliverables.map((d) => ({ type: "deliverable", id: d.id, title: d.title, subtitle: d.project.name, href: `/app/projects/${d.projectId}/deliverables#${d.id}` })),
    ...invoices.map((i) => ({ type: "invoice", id: i.id, title: i.number ?? "Draft invoice", subtitle: i.client.company || `${i.client.firstName} ${i.client.lastName}`, href: `/app/invoices/${i.id}` })),
    ...files.map((f) => ({ type: "file", id: f.id, title: f.name, subtitle: "File", href: f.projectId ? `/app/projects/${f.projectId}/files` : `/app/files` })),
  ];
  return NextResponse.json({ results });
}
