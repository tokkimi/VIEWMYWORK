import { env } from "@/lib/env";
import { safeFetch } from "@/lib/safe-fetch";

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

/**
 * Inspects a URL once (cached on the Preview row) to decide whether it can be framed, and
 * extracts a title + social image used as the fallback "screenshot" when framing is blocked.
 */
export async function inspectUrl(url: string) {
  try {
    const r = await safeFetch(url);
    const xfo = (r.headers.get("x-frame-options") ?? "").toLowerCase();
    const csp = (r.headers.get("content-security-policy") ?? "").toLowerCase();
    const fa = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("frame-ancestors"));
    const ourHost = (() => { try { return new URL(env.appUrl).hostname; } catch { return ""; } })();
    const blockedByCsp = fa ? !(/frame-ancestors\s+.*(\*|https:)/.test(fa) || (ourHost && fa.includes(ourHost))) : false;
    // Headers only count when we actually reached the site. An error status, or a redirect to another
    // host (login wall such as Vercel Authentication, bot checkpoint…), says nothing about the site
    // itself: the visitor's browser — often already logged in — can usually display it fine.
    const sameHost = new URL(r.finalUrl).hostname.replace(/^www\./, "") === new URL(url).hostname.replace(/^www\./, "");
    const reached = r.status < 400 && sameHost;
    const refuses = reached && (xfo.includes("deny") || xfo.includes("sameorigin") || blockedByCsp);
    const embeddable = refuses ? false : reached ? true : null;
    const title = r.status >= 400 ? undefined : r.body.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1];
    const og = r.body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? r.body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
    let imageUrl: string | null = null;
    if (og) {
      try {
        const abs = new URL(decodeEntities(og), r.finalUrl);
        if (abs.protocol === "https:") imageUrl = abs.toString();
      } catch {}
    }
    return { embeddable, pageTitle: title ? decodeEntities(title) : null, imageUrl };
  } catch {
    // Unreachable from our servers (timeout, bot protection…): unknown, let the browser try.
    return { embeddable: null, pageTitle: null, imageUrl: null };
  }
}
