import type { RainStation, SituationPayload } from "@/lib/situation/adapters";
import { emptyRainStations } from "./rain-stations";

export function registeredRainStations(situation: SituationPayload | null) {
  return situation?.rainStations ?? emptyRainStations();
}

export function observationTime(value: string) {
  const input = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00` : input.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}+07:00`);
}

export function isCurrentStationObservation(value: string | null | undefined, now: number) {
  // A date without a measurement time cannot confirm an update within 2 hours.
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const time = observationTime(value);
  return Number.isFinite(time) && time <= now && now - time <= 2 * 3600000;
}

export function observationLabel(value: string) {
  const time = observationTime(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short",
    ...(/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? {} : { hour: "2-digit", minute: "2-digit" } as const),
  }) : "ไม่ทราบเวลาตรวจวัด";
}

export function isRecentObservation(value: string, now: number) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    // Daily rainfall totals have a date, not a measurement time.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    return value.trim() === today;
  }
  const time = observationTime(value);
  return Number.isFinite(time) && time <= now && now - time <= 3 * 3600000;
}

export function localStations<T extends { district: string }>(stations: T[]) {
  return stations.filter((station) => /^(?:อำเภอ|อ\.)?\s*(ป่าพะยอม|ควนขนุน)$/.test(station.district.trim()));
}

export function localRain(situation: SituationPayload | null, period: "rain24h" | "rain72h"): RainStation[] {
  return localStations(situation?.thaiWater[period] ?? []).filter((station) => Number.isFinite(station.rainfallMm) && station.rainfallMm >= 0)
    .sort((a, b) => b.rainfallMm - a.rainfallMm);
}
