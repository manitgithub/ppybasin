import registry from "./situation/rain-stations.json";
import type { RainStation } from "./situation/adapters";

// Registry and order from the reference site's #rainview, checked 2026-10-24.
// These are rain-capable stations, including neighboring stations in three provinces.
export const rainStationRegistry = registry;
export const RAIN_REGISTRY_URL = "https://pa-phayom-station-map.dpakorn75.chatgpt.site/#rainview";
export const rainZoneLabels: Record<string, string> = {
  "pa-phayom": "ป่าพะยอม", "tha-nae": "คลองท่าแนะ", nearby: "สถานีข้างเคียง",
};

export type RegisteredRainStation = Omit<RainStation, "rainfallMm" | "accumulationHours"> & {
  code: string;
  area: string;
  zone: string;
  accumulationHours: 24;
  rainfallMm: number | null;
};

export function emptyRainStations(): RegisteredRainStation[] {
  return rainStationRegistry.map(station => ({
    id: station.code, code: station.code, name: station.name,
    lat: station.lat, lng: station.lng, area: station.area, zone: station.zone,
    district: "", tambon: "", province: "", agency: station.agency,
    accumulationHours: 24, rainfallMm: null, observedAt: "",
    sourceUrl: station.ridId ? "https://telerid.rid.go.th/"
      : station.agency.includes("EWS") ? "https://ews.dwr.go.th/ews/index.php"
        : station.code === "48560" ? "https://www.tmd.go.th/" : "https://www.thaiwater.net/",
  }));
}
