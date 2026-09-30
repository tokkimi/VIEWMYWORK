"use client";

import { Uploader } from "@/components/app/uploader";
import { requestPortalUploadAction, completePortalUploadAction } from "@/server/actions/portal";

export function PortalUploader({ projectId, configured, maxMb }: { projectId: string; configured: boolean; maxMb?: number }) {
  return (
    <Uploader
      target={{ projectId }}
      configured={configured}
      maxMb={maxMb}
      allowVisibility={false}
      defaultVisibility="CLIENT_VISIBLE"
      request={(i) => requestPortalUploadAction({ name: i.name, mimeType: i.mimeType, size: i.size, target: { projectId } })}
      complete={completePortalUploadAction}
    />
  );
}
