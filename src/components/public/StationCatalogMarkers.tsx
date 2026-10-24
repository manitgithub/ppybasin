"use client";

import L from "leaflet";
import { useEffect, useMemo, type RefObject } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import MapDetailsCard, { mapCoordinates, mapDetailsPopupOptions, type MapDetailMetric } from "./MapDetailsCard";
import { filterCatalog, stationMetric, type CatalogStation, type FocusedStation, type StationCategory } from "@/lib/station-catalog";
import styles from "../BasinMap.module.css";

export function StationCatalogPopup({ station, now }: { station: CatalogStation; now: number }) {
  const rain = station.rainReading, water = station.waterReading, reservoir = station.reservoirReading;
  const metrics: MapDetailMetric[] = [];
  if (station.rain) metrics.push({ label: "ฝนสะสม 24 ชั่วโมง", value: rain?.rainfallMm, unit: "มม.", observedAt: rain?.observedAt });
  if (water || !station.rain && !station.flow && !station.reservoir) metrics.push({ label: "ระดับน้ำ", value: water?.waterLevelMsl ?? water?.waterLevelM, unit: water?.waterLevelMsl !== null && water?.waterLevelMsl !== undefined ? "ม.รทก." : "ม.", observedAt: water?.observedAt });
  if (station.flow) metrics.push({ label: "อัตราการไหล", value: water?.dischargeM3s, unit: "ลบ.ม./วินาที", observedAt: water?.observedAt });
  if (station.reservoir) metrics.push(
    { label: "น้ำในอ่าง", value: reservoir?.capacityPercent, unit: "% ของความจุ", observedAt: reservoir?.latestDataDate },
    { label: "ปริมาตรน้ำ", value: reservoir?.storageMcm, unit: "ล้าน ลบ.ม." },
    { label: "น้ำไหลเข้า", value: reservoir?.inflowMcm, unit: "ล้าน ลบ.ม." },
    { label: "ระบายออก", value: reservoir?.outflowMcm, unit: "ล้าน ลบ.ม." },
  );
  return <MapDetailsCard code={station.code} title={station.name} area={station.area} now={now}
    tags={[...(station.rain ? ["น้ำฝน"] : []), ...(water || !station.rain && !station.flow && !station.reservoir ? ["ระดับน้ำ"] : []), ...(station.flow ? ["อัตราการไหล"] : []), ...(station.reservoir ? ["อ่างเก็บน้ำ"] : [])]}
    metrics={metrics} metadata={[{ label: "หน่วยงาน", value: station.agency }, { label: "พิกัด", value: mapCoordinates(station.lat, station.lng) }]}
    note={station.code === "X.124" ? "สถานีอ้างอิงข้อมูลประวัติ · ยังไม่มีค่าปัจจุบันที่ยืนยันได้" : undefined}
    sources={[
      ...(rain?.sourceUrl ? [{ label: rain.rainfallMm !== null ? "ThaiWater / สสน. · ฝน 24 ชั่วโมง" : station.agency, url: rain.sourceUrl }] : []),
      ...(station.flow || water ? [{ label: "ThaiWater / สสน. · ข้อมูลน้ำ", url: "https://api-v3.thaiwater.net/api/v1/thaiwater30/provinces/waterlevel?province_code=93" }] : []),
      ...(station.reservoir ? [{ label: "กรมชลประทาน · อ่างเก็บน้ำป่าพะยอม", url: reservoir?.sourceUrl ?? "https://app.rid.go.th/reservoir/" }] : []),
    ]} />;
}

export function StationCatalogFocus({ station, markers }: { station?: FocusedStation | null; markers: RefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!station) return;
    map.setView([station.lat, station.lng], Math.max(13, map.getZoom()), { animate: false });
    markers.current.get(station.code)?.openPopup();
  }, [station, markers, map]);
  return null;
}

export default function StationCatalogMarkers({ stations, category, showRain, showWaterLevels, now, markers }: {
  stations: CatalogStation[]; category: StationCategory; showRain: boolean; showWaterLevels: boolean; now: number;
  markers: RefObject<Map<string, L.Marker>>;
}) {
  // Rain markers keep their 24-hour number badges. Only render the other
  // reference stations here, or the chosen flow/reservoir category.
  const visible = useMemo(() => filterCatalog(stations, category).filter(station =>
    category === "all" ? station.reservoir ? showRain : !station.rain && showWaterLevels : category === "flow" ? showWaterLevels : category === "reservoir" && showRain,
  ), [stations, category, showRain, showWaterLevels]);
  const icons = useMemo(() => visible.map(station => {
    const metric = stationMetric(station, category), available = metric.value !== null && Number.isFinite(metric.value);
    const value = available ? metric.value!.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : "—";
    return L.divIcon({
      className: `catalog-station-marker ${styles.rainMarker} ${!available ? styles.muted : ""}`,
      html: `<span class="${styles.catalogSymbol}">${station.reservoir ? "อ่าง" : station.flow ? "Q" : "WL"}</span><span class="${styles.value}">${value}${available ? `<small> ${station.reservoir ? "%" : station.flow ? "ลบ.ม./วิ." : "ม."}</small>` : ""}</span>`,
      iconSize: [72, 50], iconAnchor: [36, 16], popupAnchor: [0, -18],
    });
  }), [visible, category]);
  return <>{visible.map((station, index) => <Marker key={station.code} position={[station.lat, station.lng]} icon={icons[index]} title={`${station.code} · ${station.name}`} ref={marker => { if (marker) markers.current.set(station.code, marker); else markers.current.delete(station.code); }}>
    <Popup {...mapDetailsPopupOptions}><StationCatalogPopup station={station} now={now} /></Popup>
  </Marker>)}</>;
}
