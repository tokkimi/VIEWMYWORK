import { lookup } from "node:dns/promises";
import net from "node:net";

/** Blocks SSRF: only public http(s) hosts on standard ports, re-validated on every redirect hop. */
function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

export async function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) URLs are allowed.");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Non-standard ports are not allowed.");
  if (u.username || u.password) throw new Error("Credentials in URLs are not allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private hosts are not allowed.");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Private network addresses are not allowed.");
  return u;
}

export async function safeFetch(url: string, opts: { maxBytes?: number; timeoutMs?: number; method?: "GET" | "HEAD" } = {}) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { method: opts.method ?? "GET", redirect: "manual", signal: AbortSignal.timeout(opts.timeoutMs ?? 6000), headers: { "User-Agent": "FollowMyFuture-Preview/1.0 (+https://followmyfuture.com)", Accept: "text/html,*/*;q=0.5" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    const max = opts.maxBytes ?? 512_000;
    let body = "";
    if (opts.method !== "HEAD" && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let size = 0;
      while (size < max) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        body += dec.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    }
    return { finalUrl: current, status: res.status, headers: res.headers, body };
  }
  throw new Error("Too many redirects.");
}
