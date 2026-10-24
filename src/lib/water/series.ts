import registry from "./stations.json";

export const waterStations = registry;
export type WaterStation = typeof registry[number];
export type WaterMetric = "h" | "q";
export type WaterMode = "hourly" | "daily";
export type DailyMethod = "at06" | "mean" | "min" | "max";
export const dailyMethods: { id: DailyMethod; label: string }[] = [
  { id: "at06", label: "ค่าตรวจวัดเวลา 06:00 น." }, { id: "mean", label: "ค่าเฉลี่ยตัวอย่างในวัน" },
  { id: "min", label: "ค่าต่ำสุดที่ตรวจวัดในวัน" }, { id: "max", label: "ค่าสูงสุดที่ตรวจวัดในวัน" },
];
export const HOUR = 3600000, DAY = 24 * HOUR;
export type WaterRow = { t: number; h: number | null; q: number | null };
export type WaterPoint = { t: number; value: number | null; observedAt: number | null; coverage?: number; partial?: boolean };
export type WaterSeries = {
  station: WaterStation; rows: WaterRow[]; thresholds: { warning?: number; critical?: number; bank?: number };
  sourceURL: string; errors: string[]; fetchedAt: string; servedAt: string; requestedDays: number;
  sourceAvailable: boolean; servedFromArchive: boolean;
};
export const WATER_REFERENCE = "https://pa-phayom-station-map.dpakorn75.chatgpt.site";

export function waterNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && ![-9.99, -999, -9999, 9999, 999999].some(missing => Math.abs(n - missing) < .00001) ? n : null;
}
export function waterTime(value: unknown): number {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  if (typeof value !== "string" || !value.trim()) return NaN;
  const s = value.trim().replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : `${s.length === 10 ? s + "T00:00:00" : s}+07:00`);
}
export function thaiDay(t: number) { return new Date(t + 7 * HOUR).toISOString().slice(0, 10); }
export function normalizeWaterRows(input: unknown, now: number): WaterRow[] {
  if (!Array.isArray(input) || input.length > 100000) throw new Error("Unexpected water series");
  const rows = new Map<number, WaterRow>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const t = waterTime(raw.t);
    if (!Number.isFinite(t) || t > now + 5 * 60000 || t < now - 181 * DAY) continue;
    rows.set(t, { t, h: waterNumber(raw.h), q: waterNumber(raw.q) });
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}
export function hourlyWater(rows: WaterRow[], hours: number, metric: WaterMetric, now: number): WaterPoint[] {
  const end = Math.floor(now / HOUR) * HOUR, start = end - (hours - 1) * HOUR;
  const buckets = new Map<number, WaterRow>();
  for (const row of rows) {
    const key = Math.floor(row.t / HOUR) * HOUR;
    if (key < start || key > end || row.t > now) continue;
    if (!buckets.has(key) || row.t > buckets.get(key)!.t) buckets.set(key, row);
  }
  return Array.from({ length: hours }, (_, i) => {
    const t = start + i * HOUR, row = buckets.get(t);
    return { t, value: row?.[metric] ?? null, observedAt: row?.t ?? null };
  });
}
function cadence(rows: WaterRow[]) {
  const gaps = rows.slice(1).map((row, i) => row.t - rows[i].t).filter(gap => gap > 0 && gap <= HOUR).sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : HOUR;
}
export function dailyWater(rows: WaterRow[], days: number, metric: WaterMetric, method: DailyMethod, now: number): WaterPoint[] {
  const today = thaiDay(now), start = waterTime(today) - (days - 1) * DAY, step = cadence(rows);
  const groups = new Map<string, WaterRow[]>();
  for (const row of rows) {
    if (row.t > now) continue;
    const day = thaiDay(row.t);
    const list = groups.get(day) ?? []; list.push(row); groups.set(day, list);
  }
  return Array.from({ length: days }, (_, i) => {
    const t = start + i * DAY, day = thaiDay(t), valid = (groups.get(day) ?? []).filter(row => row[metric] !== null);
    const expected = Math.max(1, Math.round(DAY / step));
    const coverage = Math.min(100, new Set(valid.map(row => Math.floor((row.t - t) / step))).size / expected * 100);
    const point: WaterPoint = { t, value: null, observedAt: null, coverage, partial: day === today };
    if (method === "at06") {
      const row = valid.find(row => row.t === t + 6 * HOUR);
      if (row) { point.value = row[metric]; point.observedAt = row.t; }
    } else if (!point.partial && coverage >= 90 && valid.length) {
      const values = valid.map(row => row[metric]!);
      point.value = method === "min" ? Math.min(...values) : method === "max" ? Math.max(...values) : values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    return point;
  });
}
export function latestWater(rows: WaterRow[], metric: WaterMetric) { return [...rows].reverse().find(row => row[metric] !== null) ?? null; }
export function waterChange(rows: WaterRow[], hours: number, metric: WaterMetric, now: number): number | null {
  const latest = latestWater(rows, metric);
  if (!latest || now - latest.t > 2 * HOUR || latest.t > now + 5 * 60000) return null;
  const target = latest.t - hours * HOUR, tolerance = Math.min(cadence(rows) / 2, 10 * 60000);
  const before = rows.filter(row => row[metric] !== null && row.t < latest.t && Math.abs(row.t - target) <= tolerance).sort((a, b) => Math.abs(a.t - target) - Math.abs(b.t - target))[0];
  return before ? latest[metric]! - before[metric]! : null;
}

export function parseWaterSeries(raw: unknown, station: WaterStation, requestedDays: number, now = Date.now()): WaterSeries {
  if (!raw || typeof raw !== "object") throw new Error("Unexpected water payload");
  const payload = raw as Record<string, unknown>, supplied = payload.station as Record<string, unknown> | undefined;
  if (supplied?.code !== station.code || supplied.unit !== station.unit) throw new Error("Water station or unit mismatch");
  const values = payload.thresholds && typeof payload.thresholds === "object" ? payload.thresholds as Record<string, unknown> : {};
  const warning = waterNumber(values.warning), critical = waterNumber(values.critical), bank = waterNumber(values.bank);
  const thresholds: WaterSeries["thresholds"] = {};
  if (warning !== null && critical !== null && warning < critical) { thresholds.warning = warning; thresholds.critical = critical; }
  if (bank !== null) thresholds.bank = bank;
  let sourceURL = station.ridId ? "https://telerid.rid.go.th/" : station.waterId ? "https://www.thaiwater.net/" : `${WATER_REFERENCE}/#waterview`;
  if (typeof payload.sourceURL === "string") {
    try { const url = new URL(payload.sourceURL); if (url.protocol === "https:" && ["telerid.rid.go.th", "api-v3.thaiwater.net", "www.thaiwater.net", "hydro-8.com"].includes(url.hostname)) sourceURL = url.href; } catch { /* Use the known public source. */ }
  }
  return {
    // The source archive can return all 180 days even for a seven-day query.
    // Keep one boundary day for hourly buckets, without shipping unrelated history.
    station, rows: normalizeWaterRows(payload.rows, now).filter(row => row.t >= waterTime(thaiDay(now)) - requestedDays * DAY), thresholds, sourceURL, requestedDays,
    errors: Array.isArray(payload.errors) ? payload.errors.filter((value): value is string => typeof value === "string").slice(0, 10) : [],
    fetchedAt: typeof payload.fetchedAt === "string" && Number.isFinite(waterTime(payload.fetchedAt)) ? payload.fetchedAt : "",
    servedAt: new Date(now).toISOString(), sourceAvailable: payload.sourceAvailable === true, servedFromArchive: payload.servedFromArchive === true,
  };
}
