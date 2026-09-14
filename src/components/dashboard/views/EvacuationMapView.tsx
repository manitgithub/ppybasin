"use client";

import L from "leaflet";
import { AlertTriangle, Database, Gauge, Hospital, LocateFixed, MapPinned, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { DashboardPayload, Shelter } from "@/lib/dashboard-data";
import type { SituationPayload, WaterLevelStation } from "@/lib/situation/adapters";

type EvacuationMapViewProps = {
  data: DashboardPayload;
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

export default function EvacuationMapView({ data }: EvacuationMapViewProps) {
  const [situation, setSituation] = useState<SituationPayload | null>(null);

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
  const waterStations = useMemo(() => {
    return [...(situation?.thaiWater.waterLevels ?? [])]
      .filter((station) => station.lat !== null && station.lng !== null)
      .sort((a, b) => (b.situationLevel ?? 0) - (a.situationLevel ?? 0))
      .slice(0, 8);
  }, [situation?.thaiWater.waterLevels]);

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
            <p className="text-xs font-semibold text-slate-500">ข้อมูลจริงจากฐานศูนย์อพยพและ ThaiWater/สสน. เส้นทางอพยพจะคำนวณจากตำแหน่งผู้ใช้ไปยังศูนย์ใกล้สุด</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-[7px] bg-emerald-100 px-2 py-1 text-emerald-700">ศูนย์เปิด</span>
            <span className="rounded-[7px] bg-amber-100 px-2 py-1 text-amber-800">จุดเฝ้าระวัง</span>
            <span className="rounded-[7px] bg-sky-100 px-2 py-1 text-sky-700">รอตำแหน่งผู้ใช้</span>
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
              <LocateFixed className="size-8 text-blue-700" />
              <div>
                <p className="text-xs font-extrabold text-slate-500">หลักการหาเส้นทาง</p>
                <p className="text-sm font-extrabold text-slate-800">จากตำแหน่งปัจจุบันไปศูนย์อพยพใกล้ที่สุด</p>
              </div>
            </div>
          </article>
        </div>

        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-extrabold text-slate-800">เส้นทางอพยพ</h3>
            <p className="text-xs font-semibold text-slate-500">จะใช้ตำแหน่งผู้ใช้เป็นต้นทาง ไม่ใช้สถานีระดับน้ำเป็นต้นทาง</p>
          </div>
          <div className="p-5">
            <div className="rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
              ยังไม่แสดงรายการเส้นทางล่วงหน้า ขั้นถัดไปควรเพิ่มปุ่มใช้ตำแหน่งปัจจุบัน แล้วคำนวณไปศูนย์อพยพเปิดใช้งานที่ใกล้ที่สุด
            </div>
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
