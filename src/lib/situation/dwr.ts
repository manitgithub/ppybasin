import type { RainStation, SourceHealth } from "./adapters";

export const DWR_SOURCE_URL = "https://ews.dwr.go.th/ews/index.php";
export const DWR_STATION_URL = "https://ews.dwr.go.th/ews/web-service/stn";
// Include nearby upstream stations, even across district/province boundaries.
export const DWR_AREA = { lat: 7.81, lng: 99.93, radiusKm: 20 };

function number(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function dwrObservationTime(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4}) (\d{2}):(\d{2})(?: น\.)?$/.exec(value.trim());
  if (!match) return "";
  const [, day, month, rawYear, hour, minute] = match;
  const year = rawYear.length === 2 ? 2500 + Number(rawYear) - 543 : Number(rawYear) > 2400 ? Number(rawYear) - 543 : Number(rawYear);
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00+07:00`;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > new Date(Date.UTC(year, Number(month), 0)).getUTCDate() || Number(hour) > 23 || Number(minute) > 59) return "";
  return iso;
}

export function parseDwrStations(payload: unknown): RainStation[] {
  if (!Array.isArray(payload)) throw new Error("Unexpected EWS station schema");
  const stations = new Map<string, RainStation>();
  for (const row of payload) {
    if (!row || typeof row !== "object" || typeof row.stn_type !== "string" || row.stn_type.toUpperCase() !== "RF") continue;
    const lat = number(row.latitude), lng = number(row.longitude), rainfallMm = number(row.rain12h);
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const radians = Math.PI / 180;
    const a = Math.sin((lat - DWR_AREA.lat) * radians / 2) ** 2 + Math.cos(lat * radians) * Math.cos(DWR_AREA.lat * radians) * Math.sin((lng - DWR_AREA.lng) * radians / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
    const observedAt = dwrObservationTime(row.date);
    if (distanceKm > DWR_AREA.radiusKm || rainfallMm === null || rainfallMm < 0 || !observedAt || typeof row.stn !== "string" || !row.stn || typeof row.name !== "string") continue;
    const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
    const id = `DWR-${row.stn}`;
    stations.set(id, { id, name: row.name, district: text(row.amphoe), tambon: text(row.tambon), province: text(row.province), lat, lng, rainfallMm, observedAt, agency: "กรมทรัพยากรน้ำ · EWS", accumulationHours: 12, sourceUrl: DWR_SOURCE_URL });
  }
  return [...stations.values()].sort((a, b) => b.rainfallMm - a.rainfallMm);
}

export async function getDwrSituation(): Promise<{ rain12h: RainStation[]; source: SourceHealth }> {
  let rain12h: RainStation[] = [];
  let status: SourceHealth["status"] = "unavailable";
  let message = "เรียกข้อมูลสถานี EWS ไม่ได้";
  try {
    const body = new FormData();
    body.set("action", "LoadStation");
    const response = await fetch(DWR_STATION_URL, { method: "POST", body, signal: AbortSignal.timeout(15_000), next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload: unknown = await response.json();
    status = "schema_changed";
    rain12h = parseDwrStations(payload);
    status = rain12h.length ? "ok" : "no_confirmed_data";
    message = rain12h.length ? `สถานีวัดฝน ${rain12h.length} แห่ง ในรัศมี ${DWR_AREA.radiusKm} กม. รอบป่าพะยอม · ฝนสะสม 12 ชั่วโมง` : "ไม่พบค่าฝน EWS ที่ยืนยันได้ในพื้นที่ใกล้ป่าพะยอม";
  } catch { /* Preserve failure status; unavailable data is never zero rainfall. */ }
  return { rain12h, source: { id: "dwr-rain12h", label: "กรมทรัพยากรน้ำ · EWS · ฝน 12 ชั่วโมง", url: DWR_SOURCE_URL, status, message, checkedAt: new Date().toISOString() } };
}
