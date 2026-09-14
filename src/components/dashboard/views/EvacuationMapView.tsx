"use client";

import L from "leaflet";
import { AlertTriangle, Database, Gauge, Hospital, MapPinned, Route, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { DashboardPayload, Shelter } from "@/lib/dashboard-data";
import type { SituationPayload, WaterLevelStation } from "@/lib/situation/adapters";

type EvacuationMapViewProps = {
  data: DashboardPayload;
};

type RouteCandidate = {
  id: string;
  station: WaterLevelStation;
  shelter: Shelter;
  distanceM: number | null;
  durationS: number | null;
  coordinates: [number, number][];
};

const mapCenter: [number, number] = [7.807, 100.025];
const mapBounds: [[number, number], [number, number]] = [
  [7.42, 99.78],
  [7.95, 100.35],
];

function formatNumber(value: number | null | undefined, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function toneForWaterStation(station: WaterLevelStation) {
  if ((station.situationLevel ?? 0) >= 4) return { label: "วิกฤต", color: "#e11d48", bg: "bg-rose-50", text: "text-rose-800" };
  if ((station.situationLevel ?? 0) >= 3) return { label: "ควรจับตา", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-800" };
  if ((station.situationLevel ?? 0) >= 2) return { label: "เฝ้าระวัง", color: "#0ea5e9", bg: "bg-sky-50", text: "text-sky-800" };
  return { label: "ปกติ", color: "#10b981", bg: "bg-emerald-50", text: "text-emerald-800" };
}

function shelterColor(status: Shelter["status"]) {
  if (status === "full") return "#e11d48";
  if (status === "open") return "#10b981";
  return "#f59e0b";
}

function shelterIcon(shelter: Shelter) {
  const color = shelterColor(shelter.status);
  return L.divIcon({
    className: "evacuation-shelter-marker",
    html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:${color};border:3px solid white;box-shadow:0 8px 20px rgba(15,23,42,.28);color:white;font-size:16px;font-weight:900">⌂</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function MapBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { animate: false, padding: [28, 28] });
      return;
    }
    map.fitBounds(mapBounds, { animate: false, padding: [18, 18] });
  }, [map, points]);

  return null;
}

function nearestShelter(station: WaterLevelStation, shelters: Shelter[]) {
  if (station.lat === null || station.lng === null || shelters.length === 0) return null;

  return shelters.reduce<Shelter | null>((nearest, shelter) => {
    if (!nearest) return shelter;
    const stationPoint = { lat: station.lat ?? 0, lng: station.lng ?? 0 };
    const currentDistance = distanceKm(stationPoint, { lat: shelter.lat, lng: shelter.lng });
    const nearestDistance = distanceKm(stationPoint, { lat: nearest.lat, lng: nearest.lng });
    return currentDistance < nearestDistance ? shelter : nearest;
  }, null);
}

async function fetchRoute(station: WaterLevelStation, shelter: Shelter): Promise<RouteCandidate> {
  const url = `https://router.project-osrm.org/route/v1/driving/${station.lng},${station.lat};${shelter.lng},${shelter.lat}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  const payload = await response.json();
  const route = payload?.routes?.[0];
  const coordinates: [number, number][] = Array.isArray(route?.geometry?.coordinates)
    ? route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng])
    : [];

  return {
    id: `${station.id}-${shelter.id}`,
    station,
    shelter,
    distanceM: typeof route?.distance === "number" ? route.distance : null,
    durationS: typeof route?.duration === "number" ? route.duration : null,
    coordinates,
  };
}

export default function EvacuationMapView({ data }: EvacuationMapViewProps) {
  const [situation, setSituation] = useState<SituationPayload | null>(null);
  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [routeStatus, setRouteStatus] = useState("ยังไม่ได้คำนวณเส้นทาง");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/situation", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SituationPayload>;
      })
      .then(setSituation)
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const shelters = useMemo(
    () => data.shelters.filter((shelter) => Number.isFinite(shelter.lat) && Number.isFinite(shelter.lng)),
    [data.shelters],
  );
  const openShelters = useMemo(() => shelters.filter((shelter) => shelter.status === "open"), [shelters]);
  const waterStations = useMemo(() => {
    return [...(situation?.thaiWater.waterLevels ?? [])]
      .filter((station) => station.lat !== null && station.lng !== null)
      .sort((a, b) => (b.situationLevel ?? 0) - (a.situationLevel ?? 0))
      .slice(0, 8);
  }, [situation?.thaiWater.waterLevels]);

  useEffect(() => {
    const routeStations = waterStations.slice(0, 3);
    const routeShelters = openShelters.length ? openShelters : shelters;

    if (!routeStations.length || !routeShelters.length) {
      setRoutes([]);
      setRouteStatus("ยังไม่มีจุดต้นทางหรือศูนย์อพยพจริงเพียงพอสำหรับคำนวณเส้นทาง");
      return;
    }

    let cancelled = false;
    setRouteStatus("กำลังคำนวณเส้นทางถนนจริงจาก OSRM...");

    Promise.all(
      routeStations.map((station) => {
        const shelter = nearestShelter(station, routeShelters);
        return shelter ? fetchRoute(station, shelter) : Promise.resolve(null);
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const validRoutes = results.filter((route): route is RouteCandidate => Boolean(route && route.coordinates.length));
        setRoutes(validRoutes);
        setRouteStatus(validRoutes.length ? `คำนวณเส้นทางถนนได้ ${validRoutes.length.toLocaleString("th-TH")} เส้นทาง` : "OSRM ไม่ส่งคืนเส้นทางที่ยืนยันได้ จึงไม่วาดเส้นทาง");
      })
      .catch(() => {
        if (cancelled) return;
        setRoutes([]);
        setRouteStatus("เรียก OSRM ไม่สำเร็จ จึงไม่วาดเส้นทางจำลอง");
      });

    return () => {
      cancelled = true;
    };
  }, [openShelters, shelters, waterStations]);

  const mapPoints = useMemo(() => {
    const shelterPoints = shelters.map((shelter): [number, number] => [shelter.lat, shelter.lng]);
    const stationPoints = waterStations.map((station): [number, number] => [station.lat ?? 0, station.lng ?? 0]);
    return [...shelterPoints, ...stationPoints];
  }, [shelters, waterStations]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">แผนที่จุดเฝ้าระวังและศูนย์อพยพ</h3>
            <p className="text-xs font-semibold text-slate-500">ข้อมูลจริงจากฐานศูนย์อพยพ, ThaiWater/สสน. และเส้นทางถนนจาก OSRM เมื่อคำนวณได้</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-[7px] bg-emerald-100 px-2 py-1 text-emerald-700">ศูนย์เปิด</span>
            <span className="rounded-[7px] bg-amber-100 px-2 py-1 text-amber-800">จุดเฝ้าระวัง</span>
            <span className="rounded-[7px] bg-sky-100 px-2 py-1 text-sky-700">เส้นทาง OSRM</span>
          </div>
        </div>
        <div className="h-[620px]">
          <MapContainer center={mapCenter} zoom={11} minZoom={9} maxZoom={17} scrollWheelZoom className="z-0">
            <TileLayer attribution="Tiles &copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapBounds points={mapPoints} />

            {shelters.map((shelter) => (
              <Marker key={shelter.id} position={[shelter.lat, shelter.lng]} icon={shelterIcon(shelter)}>
                <Popup>
                  <strong>{shelter.name}</strong>
                  <br />
                  สถานะ {shelter.status} · รองรับ {shelter.capacity.toLocaleString("th-TH")} คน
                </Popup>
              </Marker>
            ))}

            {waterStations.map((station) => {
              const tone = toneForWaterStation(station);
              return (
                <CircleMarker
                  key={station.id}
                  center={[station.lat ?? 0, station.lng ?? 0]}
                  radius={9}
                  pathOptions={{ color: "#ffffff", fillColor: tone.color, fillOpacity: 0.94, weight: 3 }}
                >
                  <Popup>
                    <strong>{station.name}</strong>
                    <br />
                    {station.river} · {tone.label}
                    <br />
                    ระดับ {formatNumber(station.waterLevelMsl ?? station.waterLevelM, 2)} {station.waterLevelMsl !== null ? "ม.รทก." : "ม."}
                  </Popup>
                </CircleMarker>
              );
            })}

            {routes.map((route) => (
              <Polyline key={route.id} positions={route.coordinates} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.78 }} />
            ))}
          </MapContainer>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Hospital className="size-8 text-emerald-700" />
              <div>
                <p className="text-xs font-extrabold text-slate-500">ศูนย์อพยพจริงในระบบ</p>
                <p className="text-2xl font-extrabold text-slate-800">{shelters.length.toLocaleString("th-TH")} แห่ง</p>
              </div>
            </div>
          </article>
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Gauge className="size-8 text-amber-700" />
              <div>
                <p className="text-xs font-extrabold text-slate-500">สถานีระดับน้ำจาก ThaiWater</p>
                <p className="text-2xl font-extrabold text-slate-800">{waterStations.length.toLocaleString("th-TH")} สถานี</p>
              </div>
            </div>
          </article>
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-1">
            <div className="flex items-center gap-3">
              <Route className="size-8 text-blue-700" />
              <div>
                <p className="text-xs font-extrabold text-slate-500">เส้นทางถนน</p>
                <p className="text-sm font-extrabold text-slate-800">{routeStatus}</p>
              </div>
            </div>
          </article>
        </div>

        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-extrabold text-slate-800">เส้นทางที่คำนวณได้</h3>
            <p className="text-xs font-semibold text-slate-500">จากจุดเฝ้าระวังไปศูนย์อพยพใกล้สุด</p>
          </div>
          <div className="space-y-3 p-5">
            {routes.length ? (
              routes.map((route) => (
                <div key={route.id} className="rounded-[8px] bg-slate-50 px-4 py-3">
                  <p className="text-sm font-extrabold text-slate-800">{route.station.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">ไป {route.shelter.name}</p>
                  <p className="mt-2 text-xs font-extrabold text-blue-700">
                    {formatNumber((route.distanceM ?? 0) / 1000, 1)} กม. · {formatNumber((route.durationS ?? 0) / 60, 0)} นาที
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
                ยังไม่มีเส้นทางถนนที่ยืนยันได้ จึงไม่แสดงเส้นทาง mockup
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-start gap-3">
            <MapPinned className="mt-0.5 size-5 text-[#216ed7]" />
            <div>
              <h3 className="text-base font-extrabold text-slate-800">แนวทางจาก SIAHRA</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                ใช้แผนที่เป็นศูนย์กลาง แยกแหล่งข้อมูลจริง แสดงเวลาข้อมูล และไม่เติมค่าจำลองเมื่อ upstream ไม่ยืนยัน
              </p>
            </div>
          </div>
          <div className="space-y-2 text-xs font-bold text-slate-600">
            <p className="flex items-center gap-2"><Database size={14} /> ศูนย์อพยพ: ฐานข้อมูลระบบ</p>
            <p className="flex items-center gap-2"><Waves size={14} /> ระดับน้ำ: ThaiWater/สสน.</p>
            <p className="flex items-center gap-2"><AlertTriangle size={14} /> พื้นที่น้ำท่วม: {situation?.disaster.gistdaFloodBoundary.message ?? "กำลังตรวจสอบ GISTDA"}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
