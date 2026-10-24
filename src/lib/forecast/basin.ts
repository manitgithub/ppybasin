import { waterTime } from "../water/series";

export const FORECAST_REFERENCE = "https://pa-phayom-station-map.dpakorn75.chatgpt.site";
export const DAILY_FORECAST_API = "https://api-v3.thaiwater.net/api/v1/thaiwater30/provinces/wrfrom_rainforcase7d?province_code=93";
export const DAILY_FORECAST_SOURCE = "https://phatthalung.thaiwater.net/forecast/rainfall";
export const TMD_FORECAST_SOURCE = "https://data.tmd.go.th/nwpapi/doc/apidoc/forecast_area.html";
export const FORECAST_BOUNDARY_HASH = "dcd87248d83be02fbadf56fe786d2886c3f4d948fb93b13f92e7a333c5a05ca0";
const DAY = 86400000;
export const forecastColors = [
  { from: 0, label: "0–0.1", color: "#e5f1ed" }, { from: .1, label: "0.1–1", color: "#c4e6ea" },
  { from: 1, label: "1–5", color: "#7cc8d6" }, { from: 5, label: "5–10", color: "#379ebc" },
  { from: 10, label: "10–20", color: "#2376a7" }, { from: 20, label: "20–35", color: "#215789" },
  { from: 35, label: "35 ขึ้นไป", color: "#20365f" },
];
export type DailyRainForecast = { date: string; start: number; end: number; rainMm: number | null; category: string; mediaTime: string | null };
export type DailyForecast = { rows: DailyRainForecast[]; fetchedAt: string; mediaMismatch: boolean; issuedAt: null };
export type TmdPoint = { lat: number; lon: number; rain: number | null; areaKm2: number };
export type TmdFrame = { time: string; requestedTime: string; fetchedAt: string | null; missing: boolean; meanMm: number | null; maxMm: number | null; coverage: number; points: TmdPoint[] };
export type TmdForecast = { frames: TmdFrame[]; createdAt: string | null; modelRunVerified: boolean; issuedAt: string | null };
export type BasinForecast = { checkedAt: string; daily: DailyForecast | null; tmd: TmdForecast | null; errors: { daily?: string; tmd?: string } };

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function rainNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number < 10000 ? number : null;
}
function dateText(value: unknown): string | null { return typeof value === "string" && Number.isFinite(waterTime(value)) ? value : null; }

export function parseDailyForecast(input: unknown, now = Date.now()): DailyForecast {
  const data = record(input);
  if (data.result !== "OK" || !Array.isArray(data.data)) throw new Error("Daily forecast schema changed");
  const rows: DailyRainForecast[] = [], dates = new Set<string>();
  for (const value of data.data) {
    const row = record(value);
    if (String(row.province_id) !== "93") continue;
    const date = String(row.forecast_datetime ?? "").slice(0, 10);
    const start = waterTime(`${date}T07:00:00+07:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== date) continue;
    if (dates.has(date)) throw new Error("Duplicate forecast dates");
    dates.add(date);
    rows.push({ date, start, end: start + DAY, rainMm: rainNumber(row.rainfall), category: typeof row.rainfall_text === "string" ? row.rainfall_text : "ไม่ระบุ", mediaTime: dateText(row.media_datetime) });
  }
  if (!rows.length) throw new Error("No Phatthalung forecasts");
  rows.sort((a, b) => a.start - b.start);
  return { rows, issuedAt: null, fetchedAt: new Date(now).toISOString(), mediaMismatch: rows.some(row => row.mediaTime && (row.start - waterTime(row.mediaTime) > 14 * DAY || waterTime(row.mediaTime) > now + 3600000)) };
}
export function activeForecastDays(rows: DailyRainForecast[], now: number) { return rows.filter(row => row.end > now && row.start <= now + 8 * DAY); }

export function parseTmdForecast(input: unknown): TmdForecast {
  const payload = record(input), series = record(payload.series);
  if (!Array.isArray(payload.frames) || payload.frames.length > 240) throw new Error("TMD schema changed");
  const seen = new Set<number>();
  const frames = payload.frames.map(value => {
    const frame = record(value), boundary = record(frame.boundary);
    const requestedTime = dateText(frame.requested_time), time = dateText(frame.source_time) ?? requestedTime;
    if (!time || !requestedTime || seen.has(waterTime(time))) throw new Error("Invalid TMD time");
    seen.add(waterTime(time));
    if (frame.missing) return { time, requestedTime, fetchedAt: dateText(frame.fetched_at), missing: true, meanMm: null, maxMm: null, coverage: 0, points: [] } satisfies TmdFrame;
    if (frame.domain !== 2 || boundary.source_sha256 !== FORECAST_BOUNDARY_HASH || !Array.isArray(frame.points) || frame.points.length > 2000 || !String(frame.unit).startsWith("mm per hourly")) throw new Error("TMD domain, units or boundary changed");
    const coordinates = new Set<string>();
    const points = frame.points.map(value => {
      const p = record(value), lat = typeof p.lat === "number" ? p.lat : NaN, lon = typeof p.lon === "number" ? p.lon : NaN;
      const areaKm2 = rainNumber(p.representative_area_km2);
      const key = `${lat},${lon}`;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 7.5 || lat > 8.1 || lon < 99.5 || lon > 100.5 || areaKm2 === null || coordinates.has(key)) throw new Error("Invalid TMD grid point");
      coordinates.add(key);
      return { lat, lon, areaKm2, rain: rainNumber(p.rain) };
    });
    const contributing = points.filter(point => point.areaKm2 > 0), valid = contributing.filter(point => point.rain !== null);
    const validArea = valid.reduce((sum, point) => sum + point.areaKm2, 0);
    const totalArea = rainNumber(boundary.area_km2_equal_area);
    if (!totalArea || Math.abs(contributing.reduce((sum, p) => sum + p.areaKm2, 0) / totalArea - 1) > .001) throw new Error("TMD representative area mismatch");
    const coverage = Math.min(1, validArea / totalArea);
    const complete = valid.length === contributing.length && frame.grid_hull_covers_basin === true && coverage > .999;
    return { time, requestedTime, fetchedAt: dateText(frame.fetched_at), missing: false, points, coverage,
      meanMm: complete ? valid.reduce((sum, p) => sum + p.rain! * p.areaKm2, 0) / validArea : null,
      maxMm: valid.length ? Math.max(...valid.map(p => p.rain!)) : null } satisfies TmdFrame;
  }).sort((a, b) => waterTime(a.time) - waterTime(b.time));
  return { frames, createdAt: dateText(series.created_at), modelRunVerified: series.model_run_verified === true, issuedAt: dateText(series.issued_at) };
}

/** Bilinear sampling only inside complete grid cells; never crosses missing corners. */
export function tmdSampler(points: TmdPoint[]) {
  const xs = [...new Set(points.map(p => p.lon))].sort((a, b) => a - b), ys = [...new Set(points.map(p => p.lat))].sort((a, b) => a - b);
  const grid = new Map(points.map(p => [`${p.lon},${p.lat}`, p.rain]));
  function interval(axis: number[], value: number): [number, number] | null {
    if (axis.length < 2 || value < axis[0] || value > axis[axis.length - 1]) return null;
    let left = 0, right = axis.length - 1;
    while (right - left > 1) { const mid = (left + right) >> 1; if (axis[mid] <= value) left = mid; else right = mid; }
    return [axis[left], axis[right]];
  }
  return (lon: number, lat: number): number | null => {
    const xx = interval(xs, lon), yy = interval(ys, lat);
    if (!xx || !yy) return null;
    const values = [grid.get(`${xx[0]},${yy[0]}`), grid.get(`${xx[1]},${yy[0]}`), grid.get(`${xx[0]},${yy[1]}`), grid.get(`${xx[1]},${yy[1]}`)];
    if (values.some(value => value === null || value === undefined)) return null;
    const x = (lon - xx[0]) / (xx[1] - xx[0]), y = (lat - yy[0]) / (yy[1] - yy[0]);
    return values[0]! * (1 - x) * (1 - y) + values[1]! * x * (1 - y) + values[2]! * (1 - x) * y + values[3]! * x * y;
  };
}
