"use client";

import { Children, createContext, useContext, useMemo } from "react";
import { makeI18n, type I18n, type Locale, type Vars } from "./core";

const Ctx = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const locale = useContext(Ctx);
  return useMemo(() => makeI18n(locale), [locale]);
}

/** Translates a string child in the viewer's language; usable from server components too. */
export function Tr({ children, vars }: { children: string; vars?: Vars }) {
  const { t } = useI18n();
  return <>{t(children, vars)}</>;
}

/** Translates a string, keeping its surrounding whitespace. */
function tTrim(t: I18n["t"], s: string) {
  const m = s.match(/^(\s*)(.*?)(\s*)$/s)!;
  return m[2] ? m[1] + t(m[2]) + m[3] : s;
}

/** Renders a ReactNode, translating plain string parts (e.g. button labels next to an icon). */
export function Tx({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  if (typeof children === "string") return <>{tTrim(t, children)}</>;
  if (Array.isArray(children)) return <>{Children.map(children, (c) => (typeof c === "string" ? tTrim(t, c) : c))}</>;
  return <>{children}</>;
}
