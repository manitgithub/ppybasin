export type RadarFrame = { time: number; path: string };
export type RainViewerData = { host: string; generated: number; frames: RadarFrame[] };
export type RadarOverlay = { key: string; url: string; path: string; opacity: number };

export function parseRainViewer(value: unknown): RainViewerData | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  // Only allow the documented tile host and radar paths in browser requests.
  if (payload.host !== "https://tilecache.rainviewer.com" || typeof payload.generated !== "number" || !Number.isFinite(payload.generated)) return null;
  const radar = payload.radar as { past?: unknown } | undefined;
  if (!radar || !Array.isArray(radar.past)) return null;
  const frames = radar.past.filter((frame): frame is RadarFrame => Boolean(frame) && typeof frame === "object"
    && typeof frame.time === "number" && Number.isFinite(frame.time) && frame.time > 0
    && typeof frame.path === "string" && /^\/v2\/radar\/[a-zA-Z0-9_-]+$/.test(frame.path))
    .sort((a, b) => a.time - b.time)
    .filter((frame, index, list) => index === 0 || frame.time !== list[index - 1].time)
    .slice(-13);
  return frames.length ? { host: payload.host, generated: payload.generated, frames } : null;
}

export function radarTileUrl(data: RainViewerData, frame: RadarFrame) {
  return `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_0.png`;
}

export function radarFrameLabel(time: number) {
  return new Date(time * 1000).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
