"use client";

import { useState } from "react";
import { Check, PencilLine } from "lucide-react";
import { Form, Field, Textarea, Submit } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { decideDeliverableAction } from "@/server/actions/portal";

/** Approve / Request changes. A comment is mandatory when requesting changes. */
export function ReviewPanel({ deliverableId, version }: { deliverableId: string; version: number }) {
  const [mode, setMode] = useState<"idle" | "approve" | "changes">("idle");
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-[15px] font-semibold">Your review</h3>
      <p className="mt-1 text-sm text-muted">Version {version} is waiting for your decision.</p>
      {mode === "idle" && (
        <div className="mt-4 grid gap-2">
          <Button variant="primary" size="lg" onClick={() => setMode("approve")}><Check className="size-4" />Approve</Button>
          <Button size="lg" onClick={() => setMode("changes")}><PencilLine className="size-4" />Request changes</Button>
        </div>
      )}
      {mode !== "idle" && (
        <Form action={decideDeliverableAction} className="mt-4 space-y-3">
          <input type="hidden" name="deliverableId" value={deliverableId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="decision" value={mode === "approve" ? "APPROVED" : "CHANGES_REQUESTED"} />
          <Field label={mode === "approve" ? "Comment" : "What should change?"} name="comment" optional={mode === "approve"}>
            <Textarea name="comment" rows={4} required={mode === "changes"} autoFocus placeholder={mode === "changes" ? "Please describe the changes you'd like…" : "Optional"} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => setMode("idle")}>Back</Button>
            <Submit className="flex-1" size="lg">{mode === "approve" ? `Approve V${version}` : "Send change request"}</Submit>
          </div>
        </Form>
      )}
    </div>
  );
}
