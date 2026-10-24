"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, ImageOverlay, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { tmdSampler, type TmdFrame } from "@/lib/forecast/basin";
import { waterValue } from "@/components/water/WaterChart";
import styles from "./ForecastMonitor.module.css";

import { bounds, polygons, renderForecastSurface, type ForecastBoundary } from "./forecast-render";
export type { ForecastBoundary } from "./forecast-render";

function BasinViewport({ boundary }: { boundary: ForecastBoundary }) {
  const map = useMap();
  const geometry = useMemo(() => bounds(boundary), [boundary]);
  useEffect(() => {
    const { west, east, south, north } = geometry;
    map.fitBounds([[south, west], [north, east]], { padding: [20, 20], animate: false });
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, geometry]);
  return null;
}
function inside(lon: number, lat: number, boundary: ForecastBoundary) {
  function ringContains(ring: number[][]) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > lat) !== (b[1] > lat) && lon < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  return polygons(boundary).some(poly => ringContains(poly[0]) && !poly.slice(1).some(ringContains));
}
function FrameLayer({ frame, boundary, showPoints }: { frame: TmdFrame; boundary: ForecastBoundary; showPoints: boolean }) {
  const [inspected, setInspected] = useState<{ lat: number; lon: number; value: number | null } | null>(null);
  const geometry = useMemo(() => bounds(boundary), [boundary]);
  const sample = useMemo(() => tmdSampler(frame.points), [frame.points]);
  const image = useMemo(() => renderForecastSurface(frame, boundary)?.toDataURL() ?? "", [frame, boundary]);
  useMapEvents({ click(event) { if (inside(event.latlng.lng, event.latlng.lat, boundary)) setInspected({ lat: event.latlng.lat, lon: event.latlng.lng, value: sample(event.latlng.lng, event.latlng.lat) }); } });
  return <>
    {image && <ImageOverlay url={image} bounds={[[geometry.south, geometry.west], [geometry.north, geometry.east]]} opacity={.9} />}
    <GeoJSON data={boundary} interactive={false} style={{ color: "#31566a", weight: 1.5, fill: false }} />
    {showPoints && frame.points.map(point => <CircleMarker key={`${point.lat}:${point.lon}`} center={[point.lat, point.lon]} radius={3} pathOptions={{ color: "#193145", weight: 1, fillColor: "#f8fbfc", fillOpacity: 1 }}><Popup>จุดกริด TMD · {waterValue(point.rain)} มม./ช่วงรายชั่วโมง</Popup></CircleMarker>)}
    {inspected && <Popup position={[inspected.lat, inspected.lon]}><strong>{inspected.value === null ? "พื้นที่นี้ไม่มีค่ากริดรองรับครบ" : `ฝนประมาณ ${waterValue(inspected.value)} มม./ช่วงรายชั่วโมง`}</strong><p>ค่าระหว่างจุดกริด TMD ณ เวลาที่เลือก</p></Popup>}
  </>;
}
export default function ForecastMap({ frame, boundary, showPoints }: { frame: TmdFrame; boundary: ForecastBoundary; showPoints: boolean }) {
  return <div className={styles.map}><MapContainer center={[7.80, 99.97]} zoom={10} scrollWheelZoom={false}>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
    <BasinViewport boundary={boundary} />
    <FrameLayer key={frame.time} frame={frame} boundary={boundary} showPoints={showPoints} />
  </MapContainer></div>;
}
