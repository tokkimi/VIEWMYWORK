import { fr } from "./fr";

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "vmw_locale";
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", fr: "Français" };

/**
 * Placeholder values. Rich values are rendered in the target locale:
 * `{ t: "Admin" }` is translated, `{ money, currency }` and `{ date }` are formatted.
 */
export type VarValue = string | number | null | undefined | { t: string } | { money: number; currency: string } | { date: Date | string };
export type Vars = Record<string, VarValue>;
/** A translatable message: an English source string, optionally with {placeholders}. */
export type Msg = string | readonly [string, Vars?];
export type T = (key: string, vars?: Vars) => string;

const dictionaries: Record<Locale, Record<string, string>> = { en: {}, fr };

export function normalizeLocale(v?: string | null): Locale {
  return v?.trim().toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "fr";
}

/** Picks the best supported locale from an Accept-Language header. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return "en";
  const langs = header
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: tag!.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const l of langs) {
    if (l.tag.startsWith("fr")) return "fr";
    if (l.tag.startsWith("en")) return "en";
  }
  return "en";
}

function renderVar(locale: Locale, v: VarValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "object") return String(v);
  if ("t" in v) return translate(locale, v.t);
  if ("money" in v) return makeFmt(locale).money(v.money, v.currency);
  return makeFmt(locale).date(v.date);
}

function interpolate(locale: Locale, s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? renderVar(locale, vars[k]) : m));
}

/** English strings are the keys; missing translations fall back to English. */
export function translate(locale: Locale, key: string, vars?: Vars) {
  return interpolate(locale, dictionaries[locale][key] ?? key, vars);
}

export function makeT(locale: Locale): T {
  return (key, vars) => translate(locale, key, vars);
}

export function renderMsg(locale: Locale, msg: Msg) {
  return typeof msg === "string" ? translate(locale, msg) : translate(locale, msg[0], msg[1]);
}

/** Plural helper: picks the singular form for n = 1 (and 0/1 in French). */
export function plural(locale: Locale, n: number, one: string, other: string) {
  const singular = locale === "fr" ? Math.abs(n) < 2 : Math.abs(n) === 1;
  return translate(locale, singular ? one : other, { n });
}

const intlTag: Record<Locale, string> = { en: "en-US", fr: "fr-FR" };
export const intlLocale = (l: Locale) => intlTag[l];

export function makeFmt(locale: Locale) {
  const tag = intlTag[locale];
  const date = (d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
    d ? new Intl.DateTimeFormat(tag, { timeZone: "UTC", ...opts }).format(new Date(d)) : "—";
  return {
    locale,
    date,
    short: (d: Date | string | null | undefined) => date(d, { month: "short", day: "numeric" }),
    dateTime: (d: Date | string | null | undefined) =>
      d ? new Intl.DateTimeFormat(tag, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—",
    rel: (d: Date | string, now = new Date()) => {
      const diff = (new Date(d).getTime() - now.getTime()) / 1000;
      const abs = Math.abs(diff);
      const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
      if (abs < 60) return translate(locale, "just now");
      if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
      if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
      return date(d);
    },
    money: (cents: number, currency = "EUR") =>
      new Intl.NumberFormat(tag, { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100),
    moneyExact: (cents: number, currency = "EUR") => new Intl.NumberFormat(tag, { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100),
    number: (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, opts).format(n),
    month: (d: Date) => new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" }).format(d),
  };
}
export type Fmt = ReturnType<typeof makeFmt>;

export type I18n = { locale: Locale; t: T; fmt: Fmt; p: (n: number, one: string, other: string) => string };

export function makeI18n(locale: Locale): I18n {
  return { locale, t: makeT(locale), fmt: makeFmt(locale), p: (n, one, other) => plural(locale, n, one, other) };
}

/**
 * Translates a server-produced error/success message. Handles a few parameterised
 * validation messages so field labels are translated too.
 */
export function translateMessage(locale: Locale, msg: string) {
  if (locale === "en") return msg;
  const direct = dictionaries[locale][msg];
  if (direct) return direct;
  const req = msg.match(/^(.+) is required\.$/);
  if (req) return translate(locale, "{label} is required.", { label: translate(locale, req[1]!) });
  const tooLong = msg.match(/^Too big: expected string to have <=(\d+) characters$/);
  if (tooLong) return translate(locale, "Too long (maximum {n} characters).", { n: tooLong[1] });
  return msg;
}

/**
 * Stored texts (activity, history) keep their English rendering plus the source message
 * in metadata.i18n, so they can be re-rendered in each reader's language.
 */
export function withSourceMsg(msg: Msg, metadata?: Record<string, unknown> | null) {
  if (typeof msg === "string") return metadata ?? undefined;
  return { ...metadata, i18n: JSON.parse(JSON.stringify(msg)) as unknown };
}

export function storedText(locale: Locale, text: string, metadata?: unknown) {
  const m = metadata as { i18n?: unknown } | null | undefined;
  if (m && Array.isArray(m.i18n) && typeof m.i18n[0] === "string") return renderMsg(locale, m.i18n as unknown as Msg);
  return translate(locale, text);
}
