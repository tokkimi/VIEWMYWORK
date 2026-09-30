"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

const LABELS: [RegExp, string][] = [
  [/\/plan$/, "Project plan"],
  [/\/deliverables/, "Deliverables"],
  [/\/files$/, "Files"],
  [/\/requests$/, "Change requests"],
  [/\/messages$/, "Messages"],
];

/** Shows which project section is open (the sections live in the "Project" menu). */
export function PortalSectionLabel({ fallback }: { fallback: string }) {
  const path = usePathname();
  const { t } = useI18n();
  const hit = LABELS.find(([re]) => re.test(path));
  return <>{t(hit ? hit[1] : fallback)}</>;
}
