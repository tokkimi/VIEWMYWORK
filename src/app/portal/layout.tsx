import { db } from "@/lib/db";
import { requirePortal, portalProjectWhere } from "@/lib/auth/portal";
import { PortalNav } from "@/components/portal/nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePortal();
  const projects = await db.project.findMany({ where: portalProjectWhere(ctx), select: { id: true, name: true }, orderBy: { updatedAt: "desc" } });
  const s = ctx.workspace.settings;
  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <PortalNav
        brand={{ name: ctx.workspace.name, logoUrl: s?.portalLogoUrl ?? ctx.workspace.logoUrl }}
        projects={projects}
        clients={ctx.access.map((a) => ({ id: a.clientId, name: `${a.client.workspace.name}` }))}
        currentClientId={ctx.client.id}
        userName={ctx.user.name}
      />
      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
