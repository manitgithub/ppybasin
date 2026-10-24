import { rainStationRegistry, type RegisteredRainStation } from "./rain-stations";
import type { ReservoirSnapshot, SituationPayload, WaterLevelStation } from "./situation/adapters";

export type StationCategory = "all" | "rain" | "flow" | "reservoir";
export const stationCategories: { id: StationCategory; label: string }[] = [
  { id: "all", label: "ทั้งหมด" }, { id: "rain", label: "น้ำฝน" },
  { id: "flow", label: "อัตราการไหล" }, { id: "reservoir", label: "อ่าง" },
];
type StationDefinition = {
  code: string; name: string; lat: number; lng: number; agency: string; zone: string; area: string;
  rain: boolean; flow: boolean; reservoir: boolean; waterId?: string;
};
const waterIds: Record<string, string> = { FOP038: "740739", "X.276": "1095876", TSL12: "11688791", FOP037: "740738", FOP036: "740737" };
const extraStations: StationDefinition[] = [
  { code: "X.276", name: "บ้านเขาปู่", lat: 7.707240, lng: 99.841743, agency: "กรมชลประทาน", zone: "tha-nae", area: "คลองท่าแนะตอนบน", rain: false, flow: true, reservoir: false, waterId: "1095876" },
  { code: "X.277", name: "คลองท่าแนะตอนล่าง", lat: 7.740278, lng: 99.980000, agency: "กรมชลประทาน", zone: "tha-nae", area: "คลองท่าแนะตอนล่าง", rain: false, flow: false, reservoir: false },
  { code: "X.124", name: "สถานีคลองท่าแนะ (สถานีประวัติ)", lat: 7.740556, lng: 99.897222, agency: "กรมชลประทาน", zone: "tha-nae", area: "ลุ่มน้ำคลองท่าแนะ", rain: false, flow: true, reservoir: false },
];

// Full 27-station registry and ordering from the reference #mapview.
export const stationCatalog: StationDefinition[] = rainStationRegistry.flatMap(station => {
  const insertBefore: Record<string, string[]> = { TX276: ["X.276"], TX83: ["X.277"], TPN11: ["X.124"] };
  return [
    ...(insertBefore[station.code] ?? []).map(code => extraStations.find(extra => extra.code === code)!),
    { ...station, rain: true, flow: station.code === "TSL12", reservoir: station.code === "RES-PYP", waterId: waterIds[station.code] },
  ];
});
export type CatalogStation = StationDefinition & {
  rainReading: RegisteredRainStation | null;
  waterReading: WaterLevelStation | null;
  reservoirReading: ReservoirSnapshot | null;
};
export type FocusedStation = { code: string; lat: number; lng: number; revision: number };

export function catalogStations(situation: SituationPayload | null): CatalogStation[] {
  return stationCatalog.map(station => ({
    ...station,
    rainReading: situation?.rainStations?.find(reading => reading.code === station.code) ?? null,
    waterReading: [...(situation?.thaiWater.waterLevels ?? [])].filter(reading =>
      (reading.code === station.code || Boolean(station.waterId && reading.id === station.waterId))
      && reading.lat !== null && reading.lng !== null
      && Math.hypot((reading.lat - station.lat) * 111.195, (reading.lng - station.lng) * 110.16) <= 2,
    ).sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0] ?? null,
    reservoirReading: station.reservoir && situation?.reservoir.status === "ok" ? situation.reservoir : null,
  }));
}

export function filterCatalog(stations: CatalogStation[], category: StationCategory, query = "") {
  const needle = query.trim().toLocaleLowerCase("th-TH");
  return stations.filter(station => (category === "all" || station[category])
    && (!needle || `${station.code} ${station.name} ${station.agency} ${station.area}`.toLocaleLowerCase("th-TH").includes(needle)));
}

export function stationMetric(station: CatalogStation, category: StationCategory): { label: string; value: number | null; unit: string; observedAt: string } {
  if (category === "reservoir" || category === "all" && station.reservoir) return { label: "น้ำในอ่าง", value: station.reservoirReading?.capacityPercent ?? null, unit: "%", observedAt: station.reservoirReading?.latestDataDate ?? "" };
  if (category === "flow" || category === "all" && station.flow && !station.rain) return { label: "อัตราการไหล", value: station.waterReading?.dischargeM3s ?? null, unit: "ลบ.ม./วินาที", observedAt: station.waterReading?.observedAt ?? "" };
  if (station.rain) return { label: "ฝน 24 ชม.", value: station.rainReading?.rainfallMm ?? null, unit: "มม.", observedAt: station.rainReading?.observedAt ?? "" };
  const water = station.waterReading;
  return { label: "ระดับน้ำ", value: water?.waterLevelMsl ?? water?.waterLevelM ?? null, unit: water?.waterLevelMsl !== null && water?.waterLevelMsl !== undefined ? "ม.รทก." : "ม.", observedAt: water?.observedAt ?? "" };
}
