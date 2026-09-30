import Link from "next/link";
import { db } from "@/lib/db";
import { requirePortal, portalProjectWhere } from "@/lib/auth/portal";
import { ProgressBar, EmptyState } from "@/components/ui/primitives";
import { pageTitle } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export const generateMetadata = pageTitle("Projects");

export default async function PortalProjects() {
  const ctx = await requirePortal();
  const projects = await db.project.findMany({ where: portalProjectWhere(ctx), orderBy: { updatedAt: "desc" } });
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight"><Tr>Projects</Tr></h1>
      {projects.length === 0 ? <EmptyState title="No projects shared yet" /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/portal/projects/${p.id}`} className="glass block rounded-2xl p-5 hover:border-line-strong">
                <div className="text-[15px] font-medium">{p.name}</div>
                <div className="num mt-4 text-3xl font-semibold">{p.progress}%</div>
                <ProgressBar value={p.progress} className="mt-2" label={`${p.name} progress`} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
