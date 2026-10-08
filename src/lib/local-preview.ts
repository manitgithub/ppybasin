export const LOCAL_PREVIEW_USER_ID = "00000000-0000-4000-8000-000000000001";
export const LOCAL_PREVIEW_LINE_ID = "local-preview";

export function isLocalPreviewHost(host: string | null) {
  if (!host) return false;
  try {
    const url = new URL(`http://${host}`);
    return !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase());
  } catch { return false; }
}

export function allowsLocalPreview(nodeEnv: string | undefined, host: string | null, forwardedHost: string | null) {
  return nodeEnv !== "production" && isLocalPreviewHost(host) && (!forwardedHost || isLocalPreviewHost(forwardedHost));
}
