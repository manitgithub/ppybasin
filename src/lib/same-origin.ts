/**
 * True when a state-changing request comes from this site.
 *
 * Behind a reverse proxy (Nginx → container) `request.url` holds the internal address, so the
 * browser's Origin is compared with the public host the proxy forwards as well. Cross-site pages
 * cannot forge Host/X-Forwarded-Host on a simple request, and custom headers would need a CORS
 * preflight this API never grants. Requests without an Origin header (same-origin GET/HEAD in
 * some browsers, server-to-server) are allowed, as before.
 */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try { originHost = new URL(origin).host.toLowerCase(); } catch { return false; }
  const hosts = [
    request.headers.get("x-forwarded-host")?.split(",")[0],
    request.headers.get("host"),
    new URL(request.url).host,
  ].filter((value): value is string => Boolean(value)).map((value) => value.trim().toLowerCase());
  return hosts.includes(originHost);
}
