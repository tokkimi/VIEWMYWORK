import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortal, getPortalProject } from "@/lib/auth/portal";
import { AppError } from "@/lib/errors";
import { ButtonLink } from "@/components/ui/button";
import { MessageSquareDiff } from "lucide-react";
import { PortalSectionLabel } from "@/components/portal/section-label";

export default async function PortalProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePortal();
  const project = await getPortalProject(ctx, id).catch((e) => { if (e instanceof AppError) notFound(); throw e; });
  const base = `/portal/projects/${id}`;
  return (
    <>
      <div className="eyebrow mb-1"><Link href="/portal" className="hover:text-fg">{ctx.workspace.name}</Link> · <PortalSectionLabel fallback="Overview" /></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
        <ButtonLink href={`${base}/requests`} variant="primary" size="sm"><MessageSquareDiff className="size-4" />Request a change</ButtonLink>
      </div>
      {children}
    </>
  );
}
