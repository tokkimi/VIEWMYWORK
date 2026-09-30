"use client";

import { useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";

/** Posts to the server, which creates the checkout from authoritative invoice data. No amount is sent. */
export function PayButton({ token, label, from = "public", className, size = "lg" }: { token: string; label: string; from?: "public" | "portal"; className?: string; size?: "md" | "lg" }) {
  const [pending, setPending] = useState(false);
  const { t } = useI18n();
  return (
    <form action={`/i/${token}/pay`} method="post" onSubmit={() => setPending(true)} className={className}>
      <input type="hidden" name="from" value={from} />
      <button type="submit" disabled={pending} className={cn(buttonClass("primary", size), "w-full")}>
        {pending ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <CreditCard className="size-4" />}
        {pending ? t("Redirecting to secure checkout…") : label}
      </button>
      <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-subtle"><Lock className="size-3" />{t("Secure payment by Stripe")}</p>
    </form>
  );
}
