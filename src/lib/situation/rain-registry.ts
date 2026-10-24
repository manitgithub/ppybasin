import { emptyRainStations, type RegisteredRainStation } from "../rain-stations";
import type { SourceHealth } from "./adapters";

export const registryRainSources = [
  { code: "93", province: "พัทลุง" },
  { code: "80", province: "นครศรีธรรมราช" },
  { code: "92", province: "ตรัง" },
].map(source => ({ ...source, url: `https://api-v3.thaiwater.net/api/v1/thaiwater30/provinces/rain24?include_zero=1&province_code=${source.code}` }));

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function observationTime(value: string) {
  const normalized = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}+07:00`);
}

export function parseRegistryRain(payload: unknown, sourceUrl: string): RegisteredRainStation[] {
  const body = record(payload);
  if (body.result !== "OK" || !Array.isArray(body.data)) throw new Error("Unexpected ThaiWater rainfall schema");
  const registry = new Map(emptyRainStations().map(station => [station.code, station]));
  const observations = new Map<string, RegisteredRainStation>();
  for (const item of body.data) {
    const row = record(item), station = record(row.station), geocode = record(row.geocode);
    // Top-level id is an observation ID. Match the permanent station code instead.
    const code = text(station.tele_station_oldcode).toUpperCase();
    const registered = registry.get(code);
    if (!registered) continue;
    const rainfallMm = number(row.rain_24h), lat = number(station.tele_station_lat), lng = number(station.tele_station_long);
    const observedAt = text(row.rainfall_datetime), time = observationTime(observedAt);
    if (rainfallMm === null || rainfallMm < 0 || rainfallMm > 1000 || !Number.isFinite(time) || lat === null || lng === null) continue;
    // Reject a code mapped to a different location, following the reference's 2 km tolerance.
    const distanceKm = Math.hypot((lat - registered.lat!) * 111.195,
      (lng - registered.lng!) * 111.195 * Math.cos(registered.lat! * Math.PI / 180));
    if (distanceKm > 2) continue;
    const previous = observations.get(code);
    if (previous && observationTime(previous.observedAt) >= time) continue;
    observations.set(code, {
      ...registered, rainfallMm, observedAt, sourceUrl,
      district: text(record(geocode.amphoe_name).th),
      tambon: text(record(geocode.tumbon_name).th),
      province: text(record(geocode.province_name).th),
    });
  }
  return [...observations.values()];
}

export function mergeRegistryRain(observations: RegisteredRainStation[]): RegisteredRainStation[] {
  const latest = new Map<string, RegisteredRainStation>();
  for (const station of observations) {
    const previous = latest.get(station.code);
    if (!previous || observationTime(station.observedAt) > observationTime(previous.observedAt)) latest.set(station.code, station);
  }
  // Keep all 24 stations and the reference order even when a source is offline.
  return emptyRainStations().map(station => latest.get(station.code) ?? station);
}

export async function getRegistryRain(): Promise<{ stations: RegisteredRainStation[]; sources: SourceHealth[] }> {
  const results = await Promise.all(registryRainSources.map(async source => {
    let stations: RegisteredRainStation[] = [];
    let status: SourceHealth["status"] = "unavailable";
    let message = "เรียกข้อมูลฝนไม่ได้";
    try {
      const response = await fetch(source.url, {
        headers: { Accept: "application/json" }, next: { revalidate: 300 }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      status = "schema_changed";
      stations = parseRegistryRain(payload, source.url);
      status = stations.length ? "ok" : "no_confirmed_data";
      message = `จับคู่ค่าฝน 24 ชั่วโมงในทะเบียนได้ ${stations.length} แห่ง`;
    } catch { /* Missing observations remain null, never zero or 12-hour totals. */ }
    return { stations, source: {
      id: `rain-registry-${source.code}`, label: `ThaiWater / สสน. · ฝน 24 ชั่วโมง · ${source.province}`,
      url: source.url, status, message, checkedAt: new Date().toISOString(),
    } };
  }));
  return { stations: mergeRegistryRain(results.flatMap(result => result.stations)), sources: results.map(result => result.source) };
}
