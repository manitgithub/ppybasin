"use client";

import L from "leaflet";
import { Hospital, MapPin, Users } from "lucide-react";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { DashboardPayload, Shelter } from "@/lib/dashboard-data";

type ShelterOpsViewProps = {
  data: DashboardPayload;
};

const fallbackCenter: [number, number] = [7.807, 100.025];

const statusLabels: Record<string, string> = {
  open: "เปิดใช้งาน",
  standby: "เตรียมพร้อม",
  full: "เต็ม",
  closed: "ปิด",
};

function shelterTone(status: Shelter["status"]) {
  if (status === "open") return { color: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" };
  if (status === "full") return { color: "#e11d48", bg: "bg-rose-50", text: "text-rose-700" };
  return { color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700" };
}

function shelterIcon(shelter: Shelter) {
  const tone = shelterTone(shelter.status);

  return L.divIcon({
    className: "shelter-ops-marker",
    html: `<span style="display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:${tone.color};border:3px solid white;box-shadow:0 10px 24px rgba(15,23,42,.30);color:white;font-size:17px;font-weight:900">⌂</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function BoundsUpdater({ shelters }: { shelters: Shelter[] }) {
  const map = useMap();

  useEffect(() => {
    if (!shelters.length) {
      map.setView(fallbackCenter, 11, { animate: false });
      return;
    }

    const bounds = L.latLngBounds(shelters.map((shelter) => [shelter.lat, shelter.lng]));
    map.fitBounds(bounds.pad(0.18), { animate: false, padding: [24, 24] });
  }, [map, shelters]);

  return null;
}

export default function ShelterOpsView({ data }: ShelterOpsViewProps) {
  const shelters = useMemo(
    () => data.shelters.filter((shelter) => Number.isFinite(shelter.lat) && Number.isFinite(shelter.lng)),
    [data.shelters],
  );
  const openShelters = shelters.filter((shelter) => shelter.status === "open").length;
  const totalCapacity = shelters.reduce((sum, shelter) => sum + shelter.capacity, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">แผนที่ศูนย์อพยพ</h3>
            <p className="text-xs font-semibold text-slate-500">แสดงข้อมูลศูนย์อพยพจริงจากระบบ พร้อมสถานะและจำนวนรองรับ</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-[7px] bg-emerald-100 px-2 py-1 text-emerald-700">เปิดใช้งาน</span>
            <span className="rounded-[7px] bg-amber-100 px-2 py-1 text-amber-700">เตรียมพร้อม</span>
            <span className="rounded-[7px] bg-rose-100 px-2 py-1 text-rose-700">เต็ม</span>
          </div>
        </div>

        <div className="h-[610px]">
          <MapContainer center={fallbackCenter} zoom={11} scrollWheelZoom className="z-0">
            <TileLayer attribution="Tiles &copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <BoundsUpdater shelters={shelters} />
            {shelters.map((shelter) => (
              <Marker key={shelter.id} position={[shelter.lat, shelter.lng]} icon={shelterIcon(shelter)}>
                <Popup>
                  <strong>{shelter.name}</strong>
                  <br />
                  สถานะ {statusLabels[shelter.status] ?? shelter.status}
                  <br />
                  รองรับ {shelter.capacity.toLocaleString("th-TH")} คน
                  <br />
                  พิกัด {shelter.lat.toFixed(6)}, {shelter.lng.toFixed(6)}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Hospital className="size-8 text-[#216ed7]" />
              <div>
                <p className="text-xs font-extrabold text-slate-500">ศูนย์อพยพทั้งหมด</p>
                <p className="text-2xl font-extrabold text-slate-800">{shelters.length.toLocaleString("th-TH")} แห่ง</p>
              </div>
            </div>
          </article>
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <MapPin className="size-8 text-emerald-700" />
              <div>
                <p className="text-xs font-extrabold text-slate-500">เปิดใช้งาน</p>
                <p className="text-2xl font-extrabold text-slate-800">{openShelters.toLocaleString("th-TH")} แห่ง</p>
              </div>
            </div>
          </article>
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="size-8 text-amber-700" />
              <div>
                <p className="text-xs font-extrabold text-slate-500">รองรับรวม</p>
                <p className="text-2xl font-extrabold text-slate-800">{totalCapacity.toLocaleString("th-TH")} คน</p>
              </div>
            </div>
          </article>
        </div>

        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-extrabold text-slate-800">รายการศูนย์อพยพ</h3>
          </div>
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {shelters.length ? (
              shelters.map((shelter) => {
                const tone = shelterTone(shelter.status);
                return (
                  <article key={shelter.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-extrabold text-slate-800">{shelter.name}</h4>
                        <p className="mt-1 text-xs font-semibold text-slate-500">รองรับ {shelter.capacity.toLocaleString("th-TH")} คน</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${tone.bg} ${tone.text}`}>
                        {statusLabels[shelter.status] ?? shelter.status}
                      </span>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="px-5 py-8 text-sm font-bold text-slate-500">ยังไม่มีข้อมูลศูนย์อพยพที่มีพิกัดจริง</div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
