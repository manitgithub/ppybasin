import { publicCctvCamera } from "@/lib/cctv-stations";

type CameraStatus = { observedAt: string; checkedAt: string };
const cached = new Map<string, { value: CameraStatus; at: number }>();
const pending = new Map<string, Promise<CameraStatus>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRidCameraTime(raw: string, code: string, now = Date.now()): string | null {
  const envelope: unknown = JSON.parse(raw);
  if (!isRecord(envelope) || typeof envelope.message !== "string") return null;
  const station: unknown = JSON.parse(envelope.message);
  if (!isRecord(station) || station.code !== code || !isRecord(station.values) || !isRecord(station.values.cctv)) return null;
  const camera = station.values.cctv["1"];
  if (!isRecord(camera) || camera.path !== `/1/SKA-${code}/image.jpg` || typeof camera.unixtime !== "number") return null;
  const timestamp = camera.unixtime * 1000;
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 300_000) return null;
  return new Date(timestamp).toISOString();
}

export async function getRidCameraStatus(camera: string): Promise<CameraStatus> {
  const source = publicCctvCamera(camera);
  if (!source || source.station.provider !== "rid" || !source.station.ridStationId) throw new Error("Unknown RID camera");
  const hit = cached.get(camera);
  if (hit && Date.now() - hit.at < 30_000) return hit.value;
  const running = pending.get(camera);
  if (running) return running;
  const request = new Promise<CameraStatus>((resolve, reject) => {
    // Same public station feed used by the official dashboard, without credentials.
    const socket = new WebSocket(`wss://telerid.rid.go.th/ws/station/${source.station.ridStationId}/`);
    let settled = false;
    const finish = (value?: CameraStatus) => {
      if (settled) return;
      settled = true; clearTimeout(timer); socket.close();
      if (value) { cached.set(camera, { value, at: Date.now() }); resolve(value); }
      else reject(new Error("Camera timestamp unavailable"));
    };
    const timer = setTimeout(() => finish(), 12_000);
    socket.onerror = () => finish();
    socket.onclose = () => finish();
    socket.onmessage = (event) => {
      if (typeof event.data !== "string" || event.data.length > 2_000_000) return finish();
      try {
        const observedAt = parseRidCameraTime(event.data, source.station.code);
        if (observedAt) finish({ observedAt, checkedAt: new Date().toISOString() });
      } catch { finish(); }
    };
  });
  pending.set(camera, request);
  try { return await request; } finally { pending.delete(camera); }
}
