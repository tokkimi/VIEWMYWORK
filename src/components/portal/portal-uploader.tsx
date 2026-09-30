"use client";

import { Uploader } from "@/components/app/uploader";
import { requestPortalUploadAction, completePortalUploadAction } from "@/server/actions/portal";

export function PortalUploader({ projectId, configured }: { projectId: string; configured: boolean }) {
  return (
    <Uploader
      target={{ projectId }}
      configured={configured}
      allowVisibility={false}
      defaultVisibility="CLIENT_VISIBLE"
      request={(i) => requestPortalUploadAction({ name: i.name, mimeType: i.mimeType, size: i.size, target: { projectId } })}
      complete={completePortalUploadAction}
    />
  );
}
