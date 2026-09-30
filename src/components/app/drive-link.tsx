"use client";

import { Link2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Submit, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { linkDriveFileAction } from "@/server/actions/integrations";

export function DriveLinkDialog({ projectId }: { projectId: string }) {
  return (
    <Dialog title="Link a Google Drive file" description="The file stays in Drive — nothing is copied and it doesn't count toward your storage." trigger={(open) => <Button size="sm" variant="ghost" onClick={open}><Link2 className="size-3.5" />Link from Google Drive</Button>}>
      {(close) => (
        <Form action={linkDriveFileAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Drive link" name="url"><Input name="url" required placeholder="https://drive.google.com/file/d/…" /></Field>
          <Checkbox name="clientVisible" label="Visible to client" description="The client also needs access to the file in Google Drive to open it." />
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Link file</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}
