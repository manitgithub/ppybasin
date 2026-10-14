"use client";

import L from "leaflet";
import { BASIN_MARKER_HTML } from "@/lib/basin-map-symbols";
import { memo, useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Popup, ScaleControl, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { RainStation, WaterLevelStation } from "@/lib/situation/adapters";
import { isRecentObservation, observationLabel } from "@/lib/public-situation";
import type { PublicAlert } from "@/components/public/PublicDashboard";
import type { SensorDevice, ShelterRecord } from "@/components/dashboard/types";
import DataSource from "@/components/DataSource";
import NearbyShelterRoute from "@/components/public/NearbyShelterRoute";
import { isBasinMapShelter } from "@/lib/shelter-map";
import type { FeatureCollection, LineString, MultiPolygon, Polygon as GeoPolygon } from "geojson";

type WaterwayData = {
  waterways: Array<{ id: number; type: string; name: string; points: [number, number][] }>;
};

const center: [number, number] = [7.807, 100.025];
const paPhayomBounds: [[number, number], [number, number]] = [
  [7.72, 99.82],
  [7.89, 100.23],
];

type BasinBoundary = FeatureCollection<GeoPolygon | MultiPolygon>;

type Located<T> = { record: T; position: [number, number] };
type DatabaseLayer<T> = { points: Located<T>[]; loading: boolean; error: boolean; skipped: number };

function positionAt(lat: unknown, lng: unknown): [number, number] | null {
  const parse = (value: unknown) => typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  const latitude = parse(lat);
  const longitude = parse(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? [latitude, longitude] : null;
}

const stationIcon = L.divIcon({
  className: "",
  html: BASIN_MARKER_HTML.stations,
  iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
});
const rainIcon = L.divIcon({
  className: "basin-rain-marker",
  html: BASIN_MARKER_HTML.rain,
  iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
});
const shelterIcon = L.divIcon({
  className: "",
  html: BASIN_MARKER_HTML.shelters,
  iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
});

function layerMessage<T>(label: string, layer: DatabaseLayer<T>) {
  if (layer.loading) return `กำลังโหลด${label}จากฐานข้อมูล…`;
  if (layer.error) return `โหลด${label}จากฐานข้อมูลไม่ได้ กรุณาโหลดหน้าใหม่`;
  return `${label}: ${layer.points.length} จุด${layer.skipped ? ` · ไม่แสดง ${layer.skipped} รายการที่ไม่มีพิกัดถูกต้อง` : ""}`;
}

function BoundsUpdater({ boundary, navigating }: { boundary: BasinBoundary | null; navigating: boolean }) {
  const map = useMap();

  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (navigating) return;
      map.fitBounds(boundary ? L.geoJSON(boundary).getBounds() : paPhayomBounds, {
        animate: false,
        padding: [32, 32],
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, boundary, navigating]);

  return null;
}

function BasinMap({ showWaterways = true, showStations = true, showShelters = true, showBoundary = true, showAlerts = true, alerts = [], nearby = false, rainStations = [], waterLevels = [], showRain = false, showWaterLevels = false, now = 0 }: {
  rainStations?: RainStation[]; waterLevels?: WaterLevelStation[]; showRain?: boolean; showWaterLevels?: boolean; now?: number;
  nearby?: boolean; showWaterways?: boolean; showStations?: boolean; showShelters?: boolean; showBoundary?: boolean; showAlerts?: boolean; alerts?: PublicAlert[];
}) {
  const [boundary, setBoundary] = useState<BasinBoundary | null>(null);
  const [boundaryError, setBoundaryError] = useState(false);
  const [waterways, setWaterways] = useState<WaterwayData | null>(null);
  const [waterwaysError, setWaterwaysError] = useState(false);
  const [stations, setStations] = useState<DatabaseLayer<SensorDevice>>({ points: [], loading: true, error: false, skipped: 0 });
  const [shelters, setShelters] = useState<DatabaseLayer<ShelterRecord>>({ points: [], loading: true, error: false, skipped: 0 });

  useEffect(() => {
    const controller = new AbortController();
    async function load<T>(url: string, key: string, locate: (record: T) => [number, number] | null, update: (layer: DatabaseLayer<T>) => void, include: (record: T) => boolean = () => true) {
      try {
        const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!payload.ok || !Array.isArray(payload[key])) throw new Error("Invalid database response");
        const records: T[] = payload[key].filter(include);
        const points = records.flatMap((record) => {
          const position = locate(record);
          return position ? [{ record, position }] : [];
        });
        if (!controller.signal.aborted) update({ points, loading: false, error: false, skipped: records.length - points.length });
      } catch {
        if (!controller.signal.aborted) update({ points: [], loading: false, error: true, skipped: 0 });
      }
    }
    void load<SensorDevice>("/api/sensor/devices", "devices", (record) => positionAt(record.latitude, record.longitude), setStations);
    void load<ShelterRecord>("/api/shelters", "shelters", (record) => positionAt(record.lat, record.lng), setShelters, isBasinMapShelter);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/terrain/pa-phayom-waterways.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Waterways unavailable");
        const result: WaterwayData = await response.json();
        if (!Array.isArray(result.waterways) || !result.waterways.length) throw new Error("Waterways missing");
        setWaterways(result);
      })
      .catch(() => { if (!controller.signal.aborted) setWaterwaysError(true); });
    return () => controller.abort();
  }, []);

  const waterwayLines = useMemo<FeatureCollection<LineString>>(() => ({
    type: "FeatureCollection",
    features: (waterways?.waterways ?? []).map((waterway) => ({
      type: "Feature",
      id: waterway.id,
      properties: { name: waterway.name, main: waterway.type === "river" || waterway.type === "canal" },
      geometry: { type: "LineString", coordinates: waterway.points },
    })),
  }), [waterways]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/boundaries/pa-phayom-basin.geojson", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Boundary unavailable");
        const result: BasinBoundary = await response.json();
        if (!result.features?.length) throw new Error("Boundary missing");
        setBoundary(result);
      })
      .catch(() => { if (!controller.signal.aborted) setBoundaryError(true); });
    return () => controller.abort();
  }, []);

  const outsideMask = useMemo<FeatureCollection<GeoPolygon> | null>(() => {
    if (!boundary) return null;
    const polygons = boundary.features.flatMap(({ geometry }) => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);
    return {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...polygons.map((rings) => rings[0])] } },
        ...polygons.flatMap((rings) => rings.slice(1).map((ring) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring] } }))),
      ],
    };
  }, [boundary]);
  return (
    <>
    {boundaryError && <p role="status" className="absolute right-3 top-16 z-10 max-w-[240px] rounded bg-white p-3 text-xs text-slate-700">โหลดขอบเขตลุ่มน้ำไม่ได้ กรุณาโหลดหน้าใหม่</p>}
    {(showWaterways || showStations || showShelters) && <div role="status" className="pointer-events-none absolute bottom-20 right-3 z-10 max-w-[240px] space-y-1 rounded bg-white px-3 py-2 text-xs text-slate-700">
      {showWaterways && <p>{waterwaysError ? "โหลดเส้นทางน้ำไม่ได้ กรุณาโหลดหน้าใหม่" : waterways ? "ทางน้ำ: OpenStreetMap contributors" : "กำลังโหลดเส้นทางน้ำ…"}</p>}
      {showStations && <p>{layerMessage("สถานีตรวจวัด", stations)}</p>}
      {showShelters && <p>{layerMessage("ศูนย์อพยพ", shelters)}</p>}
    </div>}
    <MapContainer
      center={center}
      zoom={13}
      minZoom={9}
      maxZoom={16}
      zoomSnap={0.25}
      zoomControl={false}
      scrollWheelZoom
      className="z-0"
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), &copy; OpenStreetMap contributors, GIS User Community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
      />

      {showBoundary && outsideMask && <GeoJSON data={outsideMask} interactive={false} style={{ stroke: false, fillColor: "#203746", fillOpacity: .35, fillRule: "evenodd" }} />}
      {showBoundary && boundary && <>
        <GeoJSON data={boundary} interactive={false} style={{ color: "#f9fdff", weight: 5, opacity: .8, fill: false }} />
        <GeoJSON data={boundary} interactive={false} style={{ color: "#128b87", weight: 2, dashArray: "6 4", opacity: 1, fillColor: "#128b87", fillOpacity: .06 }} />
      </>}

      {showWaterways && waterways && <>
        <GeoJSON data={waterwayLines} interactive={false} style={(feature) => ({ color: "#ffffff", weight: feature?.properties?.main ? 7 : 4.5, opacity: .9, lineCap: "round", lineJoin: "round" })} />
        <GeoJSON data={waterwayLines} style={(feature) => ({ color: feature?.properties?.main ? "#006bb6" : "#149fda", weight: feature?.properties?.main ? 4 : 2.5, opacity: 1, lineCap: "round", lineJoin: "round" })}
          onEachFeature={(feature, layer) => {
            // Use textContent so names from the source cannot become HTML.
            const label = document.createElement("span");
            label.textContent = feature.properties?.name || (feature.properties?.main ? "แม่น้ำ / คลอง" : "ลำธาร / ทางน้ำย่อย");
            layer.bindTooltip(label, { sticky: true });
          }}
        />
      </>}

      {showStations && stations.points.map(({ record: station, position }) => (
        <Marker key={station.device_id} position={position} icon={stationIcon} title={`สถานีตรวจวัด ${station.name ?? station.device_id}`}>
          <Popup>
            <strong>{station.name || station.device_id}</strong>
            <p>รหัสสถานี: {station.device_id}</p>
            {station.location_name && <p>{station.location_name}</p>}
            <p>สถานะ: {{ active: "ใช้งาน", inactive: "หยุดใช้งาน", maintenance: "บำรุงรักษา" }[station.status] ?? station.status}</p>
            <DataSource label="ทะเบียนสถานีตรวจวัดในฐานข้อมูล" url="/api/sensor/devices" />
          </Popup>
        </Marker>
      ))}
      {showRain && rainStations.map((station) => {
        const position = positionAt(station.lat, station.lng);
        return position && <Marker key={`rain-${station.id}`} position={position} icon={rainIcon} title={`ฝนสะสม 24 ชั่วโมง · ${station.name}`}>
          <Popup><strong>ฝนสะสม 24 ชั่วโมง · {station.name}</strong><p>{station.district} · {station.rainfallMm} มม.</p><p>ตรวจวัด {observationLabel(station.observedAt)}</p>{!isRecentObservation(station.observedAt, now) && <p>ข้อมูลเก่าหรือเวลาไม่พร้อม</p>}<DataSource label="ThaiWater / สสน. · ฝน 24 ชั่วโมง" url="https://www.thaiwater.net/" /></Popup>
        </Marker>;
      })}
      {showWaterLevels && waterLevels.map((station) => {
        const position = positionAt(station.lat, station.lng);
        return position && <CircleMarker key={`water-${station.id}`} center={position} radius={7} pathOptions={{ color: "#464ba5", fillColor: "#d6d8fa", fillOpacity: .9, weight: 2 }}>
          <Popup><strong>ระดับน้ำ · {station.name}</strong><p>{station.waterLevelMsl !== null ? `${station.waterLevelMsl.toFixed(2)} ม.รทก.` : station.waterLevelM !== null ? `${station.waterLevelM.toFixed(2)} ม. (ระดับน้ำตามสถานี)` : "ข้อมูลไม่พร้อม"}</p><p>ตรวจวัด {observationLabel(station.observedAt)}</p>{!isRecentObservation(station.observedAt, now) && <p>ข้อมูลเก่าหรือเวลาไม่พร้อม</p>}<DataSource label="ThaiWater / สสน. · ระดับน้ำ" url="https://www.thaiwater.net/" /></Popup>
        </CircleMarker>;
      })}

      {showShelters && shelters.points.map(({ record: shelter, position }) => (
        <Marker key={shelter.id} position={position} icon={shelterIcon} title={`ศูนย์อพยพ ${shelter.name}`}>
          <Popup>
            <strong>{shelter.name}</strong>
            <p>รหัสศูนย์: {shelter.code}</p>
            <p>สถานะ: {{ open: "เปิดใช้งาน", full: "เต็ม", closed: "ปิด", standby: "เตรียมพร้อม" }[shelter.status] ?? shelter.status}</p>
            <p>ความจุตามทะเบียน: {shelter.capacity.toLocaleString("th-TH")} คน</p>
            <DataSource label={shelter.source_file ? `ทะเบียนศูนย์พักพิง · ${shelter.source_file}` : "ทะเบียนศูนย์อพยพในฐานข้อมูล"} url="/api/shelters" />
          </Popup>
        </Marker>
      ))}

      {showAlerts && alerts.filter((alert) => Number.isFinite(alert.latitude) && Number.isFinite(alert.longitude) && Math.abs(alert.latitude) <= 90 && Math.abs(alert.longitude) <= 180).map((alert) => (
        <CircleMarker key={alert.id} center={[alert.latitude, alert.longitude]} radius={12} pathOptions={{ color: alert.severity === "critical" ? "#b82828" : "#ac7415", fillOpacity: 0.3 }}>
          <Popup><strong>ประกาศที่ยืนยันแล้ว · {alert.title}</strong><p>{alert.areaName}</p><p>{alert.message}</p><DataSource label="ประกาศที่เจ้าหน้าที่อนุมัติ" url="/api/flood-alerts?public=1" /></Popup>
        </CircleMarker>
      ))}
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomleft" imperial={false} />
      <BoundsUpdater boundary={boundary} navigating={nearby} />
      {nearby && <NearbyShelterRoute shelters={shelters.points.map(({ record }) => record)} loading={shelters.loading} error={shelters.error} />}
    </MapContainer>
    </>
  );
}

export default memo(BasinMap);
