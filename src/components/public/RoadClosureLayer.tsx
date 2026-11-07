"use client";
import L from "leaflet";
import { useEffect, useState } from "react";
import { CircleMarker, Marker, Polyline, Popup, Tooltip } from "react-leaflet";
import type { RoadClosure } from "@/lib/road-closures";

// "Road closed" sign: red disc with a white bar, plus a text label so the meaning never relies on colour alone.
const closedIcon = L.divIcon({
  className: "",
  html: `<div role="img" aria-label="ปิดถนน" style="display:flex;width:max-content;align-items:center;gap:4px;transform:translate(-14px,-14px);white-space:nowrap;pointer-events:auto">
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style="flex:0 0 28px;max-width:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">
      <circle cx="14" cy="14" r="13" fill="#b82828" stroke="#fff" stroke-width="2"/>
      <rect x="6.5" y="11.5" width="15" height="5" rx="1" fill="#fff"/>
    </svg>
    <span style="background:#fff;color:#8f1f1f;border:1px solid #b82828;border-radius:4px;padding:0 5px;font:700 11px/18px system-ui,sans-serif">ปิดถนน</span>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

export default function RoadClosureLayer() {
  const [closures, setClosures] = useState<RoadClosure[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/road-closures", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error();
        setClosures(data.closures); setError(false);
      } catch { if (!controller.signal.aborted) setError(true); }
    }
    void load(); const timer = setInterval(() => void load(), 30_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  // Retain the last known closures when refreshing fails.
  const details = (c: RoadClosure) => <Popup><b>ปิดถนน · {c.name}</b><p>{c.description}</p><p>ช่วง A–B ที่อาสาสมัครรายงาน · บันทึกเมื่อ {new Date(c.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}</p>{error && <p>อัปเดตล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดไว้</p>}</Popup>;
  return <>{closures.map(c => <Polyline key={c.id} positions={[[c.aLat, c.aLng], [c.bLat, c.bLng]]} pathOptions={{ color: "#b82828", weight: 7, dashArray: "10 6" }}>{details(c)}<Tooltip>ปิดถนน · {c.name}</Tooltip></Polyline>)}
    {closures.map(c => <Marker key={`${c.id}-sign`} position={[(c.aLat + c.bLat) / 2, (c.aLng + c.bLng) / 2]} icon={closedIcon} title={`ปิดถนน · ${c.name}`} zIndexOffset={2000}>{details(c)}</Marker>)}
    {closures.flatMap(c => [<CircleMarker key={`${c.id}-a`} center={[c.aLat,c.aLng]} radius={5} pathOptions={{ color: "#b82828" }}><Tooltip>A · {c.name}</Tooltip></CircleMarker>, <CircleMarker key={`${c.id}-b`} center={[c.bLat,c.bLng]} radius={5} pathOptions={{ color: "#b82828" }}><Tooltip>B · {c.name}</Tooltip></CircleMarker>])}</>;
}
