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
    const embeddable = r.status < 400 && !xfo.includes("deny") && !xfo.includes("sameorigin") && !blockedByCsp && new URL(r.finalUrl).protocol === "https:";
    const title = r.body.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1];
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
    return { embeddable: false, pageTitle: null, imageUrl: null };
  }
}
