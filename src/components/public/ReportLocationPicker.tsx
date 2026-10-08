"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { MapPin } from "lucide-react";

export type ReportLocation = { lat: number; lng: number; accuracy?: number };
type Boundary = FeatureCollection<Polygon | MultiPolygon>;
const center: [number, number] = [7.82, 100.0];
const pin = L.divIcon({
  className: "report-map-pin",
  html: '<span><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>',
  iconSize: [38, 46], iconAnchor: [19, 46], popupAnchor: [0, -44],
});

function pointInRing(point: ReportLocation, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > point.lat) !== (yj > point.lat) && point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function insideBoundary(point: ReportLocation, boundary: Boundary) {
  return boundary.features.some(({ geometry }) => {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.some((rings) => pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole)));
  });
}
function MapInteraction({ location, boundary, onChange }: { location: ReportLocation | null; boundary: Boundary | null; onChange: (value: ReportLocation) => void }) {
  const map = useMap();
  const actionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (actionRef.current) {
      L.DomEvent.disableClickPropagation(actionRef.current);
      L.DomEvent.disableScrollPropagation(actionRef.current);
    }
  }, []);
  useMapEvents({ click: (event) => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  useEffect(() => { if (boundary && !location) map.fitBounds(L.geoJSON(boundary).getBounds(), { padding: [20, 20] }); }, [boundary, map, location]);
  useEffect(() => { if (location && !map.getBounds().contains([location.lat, location.lng])) map.panTo([location.lat, location.lng]); }, [map, location]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return <div className="report-map-center-action" ref={actionRef}><button type="button" onClick={() => { const p = map.getCenter(); onChange({ lat: p.lat, lng: p.lng }); }}><MapPin size={16} />เลือกจุดกลางแผนที่</button></div>;
}

export default function ReportLocationPicker({ location, onChange }: { location: ReportLocation | null; onChange: (value: ReportLocation) => void }) {
  const [boundary, setBoundary] = useState<Boundary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/boundaries/pa-phayom-basin.geojson", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data: Boundary = await response.json();
      if (!data.features?.length) throw new Error();
      setBoundary(data);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  return <div className="report-location-picker">
    <div className="report-location-heading"><MapPin size={19} /><b>ปักหมุดจุดเกิดเหตุ</b><span>ลุ่มน้ำป่าพะยอม</span></div>
    <p>แตะแผนที่เพื่อเลือกจุด หรือลากหมุดไปยังตำแหน่งที่เกิดเหตุ</p>
    <div className="report-location-map"><MapContainer center={center} zoom={11} zoomSnap={0.25} zoomDelta={0.5} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {boundary && <GeoJSON data={boundary} style={{ color: "#128b87", weight: 2, dashArray: "6 4", fillColor: "#128b87", fillOpacity: 0.06 }} interactive={false} />}
      <Marker draggable icon={pin} position={location ? [location.lat, location.lng] : center} eventHandlers={{ dragend: (event) => { const p = (event.target as L.Marker).getLatLng(); onChange({ lat: p.lat, lng: p.lng }); } }}><Popup>{location ? "จุดเกิดเหตุที่เลือก" : "ลากหมุดเพื่อเลือกจุดเกิดเหตุ"}</Popup></Marker>
      <MapInteraction location={location} boundary={boundary} onChange={onChange} />
    </MapContainer></div>
    <div className="report-boundary-caption"><span className="report-boundary-line" style={{ borderColor: "#128b87" }} />ขอบเขตลุ่มน้ำป่าพะยอม · <a href="https://pa-phayom-floodboard.dpakorn75.chatgpt.site/data/basin.geojson" target="_blank" rel="noreferrer">GeoJSON จากเว็บอ้างอิง</a></div>
    {error && <p className="citizen-error" role="status">โหลดขอบเขตลุ่มน้ำไม่ได้ ยังเลือกตำแหน่งได้จากแผนที่</p>}
    {location && boundary && !insideBoundary(location, boundary) && <p className="citizen-data-note" role="status">หมุดอยู่นอกขอบเขตลุ่มน้ำป่าพะยอม ตรวจสอบว่าตรงกับจุดเกิดเหตุหรือไม่</p>}
    {location && <div className="report-pin-adjust"><span>ขยับหมุดทีละประมาณ 10 เมตร</span>{[{ label: "เหนือ", lat: .0001, lng: 0 }, { label: "ใต้", lat: -.0001, lng: 0 }, { label: "ตะวันตก", lat: 0, lng: -.0001 }, { label: "ตะวันออก", lat: 0, lng: .0001 }].map((direction) => <button type="button" key={direction.label} aria-label={`เลื่อนหมุดไปทิศ${direction.label}`} onClick={() => onChange({ lat: location.lat + direction.lat, lng: location.lng + direction.lng })}>{direction.label}</button>)}</div>}
  </div>;
}
