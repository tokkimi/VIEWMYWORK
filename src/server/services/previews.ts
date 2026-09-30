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
    const blockedByCsp = fa ? !/frame-ancestors\s+(\*|https:)/.test(fa) : false;
    // Only an explicit refusal (X-Frame-Options / CSP frame-ancestors) means "blocked". An error status is
    // often just bot protection against servers: the visitor's browser can usually display the site fine.
    const refuses = xfo.includes("deny") || xfo.includes("sameorigin") || blockedByCsp;
    const embeddable = refuses ? false : r.status < 400 && new URL(r.finalUrl).protocol === "https:" ? true : null;
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
