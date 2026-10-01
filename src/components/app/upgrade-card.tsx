import Link from "next/link";
import { Lock } from "lucide-react";
import { Tr } from "@/lib/i18n/client";

/** Shown instead of a feature the workspace's plan doesn't include. */
export function UpgradeCard({ title, description, points }: { title: string; description: string; points: string[] }) {
  return (
    <div className="panel mx-auto max-w-xl rounded-2xl p-6 text-center sm:p-8">
      <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-line bg-white/[0.03]"><Lock className="size-5 text-accent" /></div>
      <h2 className="mt-4 text-lg font-semibold"><Tr>{title}</Tr></h2>
      <p className="mt-2 text-sm text-muted"><Tr>{description}</Tr></p>
      <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm text-muted">{points.map((p) => <li key={p} className="flex gap-2"><span className="text-accent">✓</span><Tr>{p}</Tr></li>)}</ul>
      <Link href="/app/settings/billing" className="mt-6 inline-flex h-9 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"><Tr>See plans</Tr></Link>
    </div>
  );
}
