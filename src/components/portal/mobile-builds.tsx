import { Apple, Play, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/primitives";
import { Tr } from "@/lib/i18n/client";

/** Client-visible iOS / Android beta distributions. Internal previews are deliberately excluded in SQL. */
export async function MobileBuilds({ projectId, preview = false }: { projectId: string; preview?: boolean }) {
  const builds = await db.preview.findMany({
    where: { projectId, visibility: "CLIENT_VISIBLE", type: { in: ["APPLE_TESTFLIGHT", "GOOGLE_PLAY"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, url: true, type: true, checkedAt: true },
  });
  if (!builds.length) return null;

  return (
    <section aria-label="Mobile test builds">
      <div className="mb-3 flex items-center gap-2"><h2 className="text-[13px] font-semibold"><Tr>Mobile test builds</Tr></h2><Badge tone="accent"><Tr>Client access</Tr></Badge></div>
      <p className="mb-3 text-sm text-muted"><Tr>Install the current build and send your feedback from the project portal.</Tr></p>
      <div className="grid gap-3 sm:grid-cols-2">
        {builds.map((build) => {
          const apple = build.type === "APPLE_TESTFLIGHT";
          const Icon = apple ? Apple : Play;
          const name = apple ? "TestFlight" : "Google Play";
          const card = <><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{build.label}</span><span className="mt-0.5 block text-xs text-muted">{name} · {apple ? "iPhone & iPad" : "Android"}</span></span><ExternalLink className="size-4 shrink-0 text-subtle" /></>;
          return preview ? <div key={build.id} className="panel flex items-center gap-3 rounded-2xl p-4">{card}</div> : <a key={build.id} href={build.url} target="_blank" rel="noreferrer noopener" className="panel flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-accent/50">{card}</a>;
        })}
      </div>
    </section>
  );
}
