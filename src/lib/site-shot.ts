/** Screenshot of a web page at a given viewport, for sites that refuse to be shown in a frame. */
export function siteShot(url: string, w: number, h: number) {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=${w}&h=${h}&vpw=${w}&vph=${h}`;
}
