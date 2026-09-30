import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, makeI18n, type Locale } from "./core";

/** Request locale: explicit choice (cookie) first, then the browser's Accept-Language. */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(c)) return c;
    return localeFromAcceptLanguage((await headers()).get("accept-language"));
  } catch {
    return "en";
  }
});

export async function getI18n() {
  return makeI18n(await getLocale());
}

export async function getT() {
  return (await getI18n()).t;
}

/** `export const generateMetadata = pageTitle("Projects")` — a translated document title. */
export function pageTitle(title: string) {
  return async () => ({ title: (await getT())(title) });
}

const YEAR = 60 * 60 * 24 * 365;

export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: false, secure: process.env.NODE_ENV === "production" });
}

/**
 * On sign-in, when the visitor hasn't picked a language on this device: a non-default account
 * language wins; otherwise the browser's language is kept. Returns the locale to store on the account.
 */
export async function adoptUserLocale(userLocale: string | null | undefined): Promise<Locale> {
  const jar = await cookies();
  const chosen = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  const locale = isLocale(userLocale) && userLocale !== "en" ? userLocale : await getLocale();
  await setLocaleCookie(locale);
  return locale;
}
