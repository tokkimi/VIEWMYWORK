import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { AppError } from "@/lib/errors";
import { LinkTabs } from "@/components/ui/tabs";

export default async function PortalProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePortal();
  const project = await getPortalProject(ctx, id).catch((e) => { if (e instanceof AppError) notFound(); throw e; });
  const base = `/portal/projects/${id}`;
  return (
    <>
      <div className="eyebrow mb-1"><Link href="/portal" className="hover:text-fg">{ctx.workspace.name}</Link></div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
      <Suspense>
        <LinkTabs className="mt-5" tabs={[{ href: base, label: "Overview" }, { href: `${base}/plan`, label: "Plan" }, { href: `${base}/deliverables`, label: "Deliverables" }, { href: `${base}/files`, label: "Files" }, { href: `${base}/messages`, label: "Messages" }]} />
      </Suspense>
      {children}
    </>
  );
}
