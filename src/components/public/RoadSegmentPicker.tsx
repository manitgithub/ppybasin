"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import RoadClosureLayer from "./RoadClosureLayer";
import type { ReportLocation } from "./ReportLocationPicker";

type Boundary = FeatureCollection<Polygon | MultiPolygon>;
type Point = "a" | "b";
const center: [number, number] = [7.82, 99.94];

const pointIcon = (label: string, active: boolean) => L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:${active ? "#17658a" : "#fff"};color:${active ? "#fff" : "#17658a"};border:3px solid #17658a;font:800 14px/1 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function Interaction({ next, onPick, boundary, hasPoints }: { next: Point | null; onPick: (point: Point, value: ReportLocation) => void; boundary: Boundary | null; hasPoints: boolean }) {
  const map = useMap();
  useMapEvents({ click: (event) => { if (next) onPick(next, { lat: event.latlng.lat, lng: event.latlng.lng }); } });
  useEffect(() => { if (boundary && !hasPoints) map.fitBounds(L.geoJSON(boundary).getBounds(), { padding: [20, 20] }); }, [boundary, map, hasPoints]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => { map.getContainer().style.cursor = next ? "crosshair" : ""; }, [map, next]);
  return null;
}

/** One map for drawing a closed road segment: first tap sets A, second tap sets B. Both points stay draggable. */
export default function RoadSegmentPicker({ a, b, onChange }: { a: ReportLocation | null; b: ReportLocation | null; onChange: (a: ReportLocation | null, b: ReportLocation | null) => void }) {
  const [boundary, setBoundary] = useState<Boundary | null>(null);
  const [redo, setRedo] = useState<Point | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/boundaries/pa-phayom-basin.geojson", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data: Boundary | null) => { if (data?.features?.length) setBoundary(data); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const next: Point | null = redo ?? (!a ? "a" : !b ? "b" : null);
  function pick(point: Point, value: ReportLocation) {
    if (point === "a") onChange(value, b); else onChange(a, value);
    setRedo(null);
  }
  const instruction = next === "a" ? "แตะแผนที่ตรงจุดเริ่มต้นช่วงที่ปิด (จุด A)"
    : next === "b" ? "แตะแผนที่ตรงจุดสิ้นสุดช่วงที่ปิด (จุด B)"
    : "ได้ช่วงถนน A–B แล้ว ลากหมุดเพื่อปรับตำแหน่ง หรือกดเลือกจุดใหม่";
  const button = "inline-flex items-center min-h-[40px] px-3 rounded-md border border-[#c9d8e0] bg-white text-[#245973] text-sm font-semibold disabled:opacity-50";

  return <div className="flex flex-col gap-2">
    <p role="status" className="m-0 rounded-md bg-[#e5edf1] px-3 py-2 text-sm font-semibold text-[#173f56]">
      <span className="mr-2 inline-block rounded bg-[#17658a] px-2 text-xs leading-5 text-white">{next ? `ขั้นที่ ${next === "a" ? 1 : 2}/2` : "ครบแล้ว"}</span>{instruction}
    </p>
    <div className="citizen-map" style={{ height: 420, minHeight: 320 }}>
      <MapContainer center={center} zoom={13} zoomSnap={0.25} zoomDelta={0.5} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {boundary && <GeoJSON data={boundary} style={{ color: "#128b87", weight: 2, dashArray: "6 4", fillColor: "#128b87", fillOpacity: 0.04 }} interactive={false} />}
        <RoadClosureLayer />
        {a && b && <Polyline positions={[[a.lat, a.lng], [b.lat, b.lng]]} pathOptions={{ color: "#17658a", weight: 6, dashArray: "8 6" }} interactive={false} />}
        {a && <Marker position={[a.lat, a.lng]} icon={pointIcon("A", next === "a")} draggable eventHandlers={{ dragend: (event) => { const p = (event.target as L.Marker).getLatLng(); onChange({ lat: p.lat, lng: p.lng }, b); } }}><Tooltip>จุด A · ลากเพื่อปรับ</Tooltip></Marker>}
        {b && <Marker position={[b.lat, b.lng]} icon={pointIcon("B", next === "b")} draggable eventHandlers={{ dragend: (event) => { const p = (event.target as L.Marker).getLatLng(); onChange(a, { lat: p.lat, lng: p.lng }); } }}><Tooltip>จุด B · ลากเพื่อปรับ</Tooltip></Marker>}
        <Interaction next={next} onPick={pick} boundary={boundary} hasPoints={Boolean(a || b)} />
      </MapContainer>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-sm text-[#3d5666]">
      <span className="mr-auto">{a ? `A ${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}` : "A ยังไม่เลือก"} → {b ? `B ${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : "B ยังไม่เลือก"}</span>
      <button type="button" className={button} disabled={!a} onClick={() => setRedo("a")}>เลือกจุด A ใหม่</button>
      <button type="button" className={button} disabled={!b} onClick={() => setRedo("b")}>เลือกจุด B ใหม่</button>
      <button type="button" className={button} disabled={!a && !b} onClick={() => { setRedo(null); onChange(null, null); }}>ล้างเส้น</button>
    </div>
  </div>;
}
