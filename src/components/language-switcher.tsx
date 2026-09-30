"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/core";
import { setLocaleAction } from "@/server/actions/locale";

/** Compact EN / FR toggle. */
export function LanguageSwitcher({ className, withIcon }: { className?: string; withIcon?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (l: Locale) =>
    start(async () => {
      if (l === locale) return;
      await setLocaleAction(l);
      router.refresh();
    });
  return (
    <div role="group" aria-label={t("Language")} className={cn("inline-flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-[11.5px]", pending && "opacity-60", className)}>
      {withIcon && <Languages className="mx-1 size-3.5 text-subtle" aria-hidden />}
      {LOCALES.map((l) => (
        <button key={l} type="button" onClick={() => pick(l)} aria-pressed={l === locale} lang={l} className={cn("rounded-md px-1.5 py-0.5 font-medium uppercase tracking-wide", l === locale ? "bg-white/[0.08] text-fg" : "text-subtle hover:text-fg")}>
          {l}
        </button>
      ))}
    </div>
  );
}
