import type { ShelterRecord } from "@/components/dashboard/types";
import { isBasinMapShelter } from "@/lib/shelter-map";

export type GpsPosition = { lat: number; lng: number; accuracy: number; timestamp: number };

export function distanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(rad(to.lat - from.lat) / 2) ** 2
    + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function rankNearbyShelters(shelters: ShelterRecord[], position: GpsPosition) {
  return shelters.filter((shelter) => isBasinMapShelter(shelter)
    && typeof shelter.lat === "number" && Number.isFinite(shelter.lat) && Math.abs(shelter.lat) <= 90
    && typeof shelter.lng === "number" && Number.isFinite(shelter.lng) && Math.abs(shelter.lng) <= 180)
    .map((shelter) => ({ ...shelter, distanceKm: distanceKm(position, shelter) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
}

export function shelterMapsUrl(shelter: { lat: number; lng: number }, origin?: GpsPosition) {
  if (!origin) return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${shelter.lat},${shelter.lng}` })}`;
  return `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: "1", origin: `${origin.lat},${origin.lng}`, destination: `${shelter.lat},${shelter.lng}`,
    travelmode: "driving", dir_action: "navigate",
  })}`;
}
