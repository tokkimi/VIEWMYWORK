import { db } from "@/lib/db";
import { requireWorkspace, requirePerm } from "@/lib/auth/context";
import { Badge } from "@/components/ui/primitives";
import { TemplateEditorDialog, TemplateRowActions } from "@/components/app/template-editor";

export const metadata = { title: "Templates" };

export default async function Templates() {
  const ctx = await requireWorkspace();
  requirePerm(ctx, "projects", "manage");
  const templates = await db.projectTemplate.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: ctx.workspace.id }] }, include: { phases: { orderBy: { position: "asc" }, include: { tasks: { orderBy: { position: "asc" } } } } }, orderBy: [{ workspaceId: { sort: "desc", nulls: "last" } }, { name: "asc" }] });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Reusable specifications. Creating a project from a template copies its structure — later template edits never change existing projects.</p>
        <TemplateEditorDialog trigger="new" />
      </div>
      <ul className="panel divide-y divide-line rounded-2xl">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">{t.name}{!t.workspaceId && <Badge>Built-in</Badge>}</div>
              <div className="truncate text-xs text-muted">{t.phases.map((p) => `${p.title} ${p.weight}`).join(" · ")}</div>
            </div>
            {t.workspaceId && <TemplateEditorDialog trigger="edit" tpl={{ id: t.id, name: t.name, category: t.category, description: t.description, phases: t.phases.map((p) => ({ title: p.title, weight: p.weight, tasks: p.tasks.map((x) => x.title) })) }} />}
            <TemplateRowActions id={t.id} own={Boolean(t.workspaceId)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
