"use client";

import L from "leaflet";
import styles from "./DistrictMap.module.css";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, ScaleControl, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Focus, MapPin } from "lucide-react";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { WaterLevelStation } from "@/lib/situation/adapters";
import type { Shelter } from "@/lib/dashboard-data";
import type { PublicAlert } from "./PublicDashboard";

type BasinBoundary = FeatureCollection<Polygon | MultiPolygon>;

function BasinViewport({ boundary, focus }: { boundary: BasinBoundary | null; focus: number }) {
  const map = useMap();
  useEffect(() => {
    if (!boundary) return;
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(L.geoJSON(boundary).getBounds(), { padding: [25, 25], animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, boundary, focus]);
  return null;
}

export default function SituationMap({ waters, alerts, shelters }: { waters: WaterLevelStation[]; alerts: PublicAlert[]; shelters: Shelter[] }) {
  const [boundary, setBoundary] = useState<BasinBoundary | null>(null);
  const [boundaryError, setBoundaryError] = useState(false);
  const [focus, setFocus] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/boundaries/pa-phayom-basin.geojson", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Boundary unavailable");
      const data: BasinBoundary = await response.json();
      if (!data.features?.length) throw new Error("Boundary missing");
      setBoundary(data);
    }).catch(() => { if (!controller.signal.aborted) setBoundaryError(true); });
    return () => controller.abort();
  }, []);
  const outsideMask = useMemo<FeatureCollection<Polygon> | null>(() => {
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

  return <div className={`district-map-panel ${styles.panel}`}>
    <div className={`district-map-heading ${styles.heading}`}><div><MapPin size={19} /><span><b>ลุ่มน้ำป่าพะยอม</b><small>โซนติดตามสถานการณ์ · ขอบเขตลุ่มน้ำ</small></span></div><button type="button" onClick={() => setFocus((value) => value + 1)} disabled={!boundary}><Focus size={17} /><span>ดูเต็มลุ่มน้ำ</span></button></div>
    {boundaryError && <p className="citizen-error" role="status">โหลดขอบเขตลุ่มน้ำไม่ได้ กรุณาโหลดหน้าใหม่</p>}
    {!boundary && !boundaryError && <p className={styles.loading} role="status">กำลังโหลดขอบเขตลุ่มน้ำ…</p>}
    <div className="citizen-map"><MapContainer center={[7.82, 99.86]} zoom={11} zoomSnap={0.25} zoomDelta={0.5} zoomAnimation={false} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {outsideMask && <GeoJSON data={outsideMask} interactive={false} style={{ stroke: false, fillColor: "#203746", fillOpacity: .35, fillRule: "evenodd" }} />}
      {boundary && <>
        <GeoJSON data={boundary} interactive={false} style={{ color: "#f9fdff", weight: 5, opacity: .8, fill: false }} />
        <GeoJSON data={boundary} interactive={false} style={{ color: "#128b87", weight: 2, dashArray: "6 4", opacity: 1, fillColor: "#128b87", fillOpacity: .06 }}>
          <Tooltip permanent direction="center" className={`district-map-label ${styles.label}`}>ลุ่มน้ำป่าพะยอม<span>ลุ่มน้ำย่อยคลองป่าพะยอม–ทะเลน้อย</span></Tooltip>
        </GeoJSON>
      </>}
      {waters.filter((s) => s.lat !== null && s.lng !== null).map((s) => <CircleMarker key={s.id} center={[s.lat!, s.lng!]} radius={7} pathOptions={{ color: "#226da0", fillOpacity: 0.8 }}><Popup><b>{s.name}</b><p>ระดับน้ำ {s.waterLevelMsl ?? "ไม่มีข้อมูล"} ม.รทก.</p><p>ตรวจวัด {new Date(s.observedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></Popup></CircleMarker>)}
      {alerts.map((s) => <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={12} pathOptions={{ color: s.severity === "critical" ? "#b82828" : "#ac7415", fillOpacity: 0.3 }}><Popup><b>ประกาศยืนยัน · {s.title}</b><p>{s.message}</p></Popup></CircleMarker>)}
      {shelters.map((s) => <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={9} pathOptions={{ color: "#257450", fillOpacity: 0.8 }}><Popup><b>{s.name}</b><p>ศูนย์ยืนยันเปิดล่าสุด · ความจุ {s.capacity} คน</p></Popup></CircleMarker>)}
      <ScaleControl position="bottomleft" imperial={false} />
      <BasinViewport boundary={boundary} focus={focus} />
    </MapContainer></div>
    <div className={styles.source}><span className={styles.boundarySwatch} />เส้นขอบลุ่มน้ำป่าพะยอม<span className={styles.outsideSwatch} />พื้นที่นอกโซน<a className={styles.note} href="https://pa-phayom-floodboard.dpakorn75.chatgpt.site/data/basin.geojson" target="_blank" rel="noreferrer">GeoJSON จากเว็บอ้างอิง</a></div>
  </div>;
}
