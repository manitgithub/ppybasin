"use client";

import L from "leaflet";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import { LocateFixed } from "lucide-react";
import type { ShelterRecord } from "@/components/dashboard/types";
import { rankNearbyShelters, type GpsPosition } from "@/lib/nearby-shelters";
import styles from "./NearbyShelterRoute.module.css";

type Route = { points: [number, number][]; distance: number; duration: number };

export default function NearbyShelterRoute({ shelters, loading, error, panelContainer }: { panelContainer?: HTMLElement | null; shelters: ShelterRecord[]; loading: boolean; error: boolean }) {
  const map = useMap();
  const panel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState<{ route: Route | null; error: string; loading: boolean }>({ route: null, error: "", loading: false });
  const [retry, setRetry] = useState(0);
  const ranked = useMemo(() => position ? rankNearbyShelters(shelters, position).filter((shelter) => shelter.status === "open") : [], [shelters, position]);
  const selected = ranked.find((shelter) => shelter.id === selectedId) ?? ranked[0];

  useEffect(() => {
    if (panel.current) { L.DomEvent.disableClickPropagation(panel.current); L.DomEvent.disableScrollPropagation(panel.current); }
    return () => { requestId.current += 1; };
  }, [panelContainer]);

  function locate() {
    setGpsError("");
    if (!window.isSecureContext || !navigator.geolocation) { setGpsError("กรุณาเปิดผ่าน HTTPS และใช้เบราว์เซอร์ที่รองรับตำแหน่ง GPS"); return; }
    const id = ++requestId.current;
    setLocating(true);
    setPosition(null);
    setSelectedId("");
    navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
      if (id !== requestId.current) return;
      setLocating(false);
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) { setGpsError("พิกัด GPS ไม่ถูกต้อง กรุณาลองใหม่"); return; }
      setPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, timestamp });
    }, (failure) => {
      if (id !== requestId.current) return;
      setLocating(false);
      setGpsError(failure.code === 1 ? "กรุณาอนุญาตตำแหน่งในเบราว์เซอร์ แล้วลองใหม่" : "รับตำแหน่ง GPS ไม่ได้ กรุณาลองใหม่");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  useEffect(() => {
    if (!position || !selected) return;
    const controller = new AbortController();
    async function loadRoute() {
      setResult({ route: null, error: "", loading: true });
      try {
        const response = await fetch("/api/evacuation-route", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: [position!.lat, position!.lng], destination: [selected!.lat, selected!.lng] }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        const payload = await response.json();
        const route = payload.route;
        if (!response.ok || !payload.ok || !Array.isArray(route?.geometry?.coordinates) || route.geometry.coordinates.length < 2
          || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new Error("Route unavailable");
        const points: [number, number][] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
        if (points.some(([lat, lng]) => !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) throw new Error("Invalid route");
        if (!controller.signal.aborted) setResult({ route: { points, distance: route.distance, duration: route.duration }, error: "", loading: false });
      } catch {
        if (!controller.signal.aborted) setResult({ route: null, error: "คำนวณเส้นทางไม่ได้ กรุณาลองใหม่", loading: false });
      }
    }
    void loadRoute();
    return () => controller.abort();
  }, [position, selected, retry]);

  const route = position && selected ? result.route : null;
  useEffect(() => {
    if (route) map.fitBounds(L.latLngBounds(route.points), { paddingTopLeft: [24, 220], paddingBottomRight: [32, 100], maxZoom: 15 });
    else if (position) map.setView([position.lat, position.lng], 13);
  }, [map, route, position]);

  const controls = <div ref={panel} className={`${styles.panel} ${panelContainer ? styles.docked : ""}`} data-nearby-panel>
      <strong>ศูนย์อพยพใกล้ฉัน</strong>
      <button type="button" onClick={locate} disabled={locating}><LocateFixed size={17} />{locating ? "กำลังรับตำแหน่ง…" : position ? "รับตำแหน่งใหม่" : "ใช้ตำแหน่งปัจจุบัน"}</button>
      {position && selected && <label>ศูนย์ปลายทาง<select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{ranked.map((shelter) => <option key={shelter.id} value={shelter.id}>{shelter.name} · {shelter.distanceKm.toFixed(1)} กม. เส้นตรง</option>)}</select></label>}
      <div aria-live="polite">
        {loading && <p>กำลังอ่านทะเบียนศูนย์อพยพ…</p>}
        {error && <p role="alert">โหลดทะเบียนไม่ได้ กรุณาโหลดหน้าใหม่</p>}
        {gpsError && <p role="alert">{gpsError}</p>}
        {position && !loading && !error && !selected && <p>ยังไม่มีศูนย์สถานะเปิดที่มีพิกัดในทะเบียน</p>}
        {position && selected && result.loading && <p>กำลังคำนวณเส้นทางถนน…</p>}
        {position && selected && result.error && <p role="alert">{result.error} <button type="button" onClick={() => setRetry((value) => value + 1)}>ลองใหม่</button></p>}
        {route && <p>ระยะทาง {(route.distance / 1000).toFixed(1)} กม. · ประมาณ {Math.ceil(route.duration / 60)} นาที</p>}
      </div>
      <small>ยืนยันการเปิดและที่ว่างกับเจ้าหน้าที่ก่อนเดินทาง เส้นทางไม่ได้ยืนยันว่าปลอดภัยจากน้ำท่วม</small>
    </div>;

  return <>
    {panelContainer ? createPortal(controls, panelContainer) : controls}
    {position && <CircleMarker center={[position.lat, position.lng]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}><Popup>ตำแหน่งของคุณ</Popup></CircleMarker>}
    {route && <><Polyline positions={route.points} pathOptions={{ color: "#fff", weight: 9, opacity: .9 }} /><Polyline positions={route.points} pathOptions={{ color: "#2563eb", weight: 5, opacity: 1 }} /></>}
  </>;
}
