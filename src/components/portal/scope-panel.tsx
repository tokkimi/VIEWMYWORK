"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Form, Field, Textarea, Submit } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { decideScopeAsClientAction } from "@/server/actions/portal";
import { Tr, useI18n } from "@/lib/i18n/client";

/** Accept / decline a scope change. A reason is required when declining. */
export function ScopePanel({ id }: { id: string }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-[15px] font-semibold"><Tr>Your decision</Tr></h3>
      <p className="mt-1 text-sm text-muted"><Tr>The team needs your agreement before doing this extra work.</Tr></p>
      {mode === "idle" && (
        <div className="mt-4 grid gap-2">
          <Button variant="primary" size="lg" onClick={() => setMode("accept")}><Check className="size-4" /><Tr>Accept</Tr></Button>
          <Button size="lg" onClick={() => setMode("decline")}><X className="size-4" /><Tr>Decline</Tr></Button>
        </div>
      )}
      {mode !== "idle" && (
        <Form action={decideScopeAsClientAction} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value={mode === "accept" ? "APPROVED" : "REJECTED"} />
          <Field label={mode === "accept" ? t("Comment") : t("Why are you declining?")} name="comment" optional={mode === "accept"}>
            <Textarea name="comment" rows={4} required={mode === "decline"} autoFocus placeholder={t("Optional")} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => setMode("idle")}><Tr>Back</Tr></Button>
            <Submit className="flex-1" size="lg">{mode === "accept" ? t("Accept the change") : t("Decline the change")}</Submit>
          </div>
        </Form>
      )}
    </div>
  );
}
