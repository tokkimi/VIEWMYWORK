"use client";

import Image from "next/image";
import developerPreviewVisual from "@/assets/marketing/developer-preview-visual.webp";

/**
 * Deterrence for casual copying. The source asset is a metadata-free WebP;
 * browsers cannot make a publicly rendered image impossible to screenshot.
 */
export function ProtectedDeveloperPreview() {
  const block = (event: React.SyntheticEvent) => event.preventDefault();
  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-line bg-[#090b14] select-none"
      onContextMenu={block}
      onCopy={block}
      onDragStart={block}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && ["c", "s"].includes(event.key.toLowerCase())) event.preventDefault();
      }}
      tabIndex={0}
      aria-label="Developer preview workflow"
    >
      <Image
        src={developerPreviewVisual}
        alt="Developer preview workflow across desktop, tablet and mobile"
        priority
        draggable={false}
        sizes="(max-width: 768px) 100vw, 1200px"
        className="pointer-events-none block h-auto w-full"
      />
    </div>
  );
}
