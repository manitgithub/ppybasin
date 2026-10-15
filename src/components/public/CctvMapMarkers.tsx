"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, useMap } from "react-leaflet";
import { RefreshCw, X } from "lucide-react";
import { BASIN_MARKER_HTML } from "@/lib/basin-map-symbols";
import { cctvStations, type CctvStation } from "@/lib/cctv-stations";
import DataSource from "@/components/DataSource";
import styles from "./CctvMapMarkers.module.css";

const cameraIcon = L.divIcon({
  className: "basin-cctv-marker", html: BASIN_MARKER_HTML.cctv,
  iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
});

type CameraFocus = { code: string; revision: number } | null;
export default function CctvMapMarkers({ focused }: { focused: CameraFocus }) {
  const [active, setActive] = useState<string | null>(null);
  return cctvStations.map((station) => <CctvMarker key={station.code} station={station} focused={focused} open={active === station.code} onOpen={setActive} onClose={() => setActive(null)} />);
}

function CctvMarker({ station, focused, open, onOpen, onClose }: {
  station: CctvStation; focused: CameraFocus; open: boolean; onOpen: (code: string) => void; onClose: () => void;
}) {
  const marker = useRef<L.Marker>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const map = useMap();
  useEffect(() => {
    if (focused?.code !== station.code) return;
    map.panTo([station.lat, station.lng], { animate: false });
    onOpen(station.code);
  }, [focused, station, map, onOpen]);
  useEffect(() => { if (open) closeButton.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, onClose]);
  const surface = map.getContainer().parentElement;
  return <>
    <Marker ref={marker} position={[station.lat, station.lng]} icon={cameraIcon} title={`กล้อง ปภ. ${station.code} · ${station.name}`}
      eventHandlers={{ click: () => onOpen(station.code) }} />
    {open && surface && createPortal(<aside className={styles.panel} role="dialog" aria-label={`ดูกล้อง ${station.code}`}>
      <button ref={closeButton} className={styles.close} type="button" aria-label="ปิดภาพกล้อง" onClick={onClose}><X size={18} /></button>
      <CctvPreview station={station} />
    </aside>, surface)}
  </>;

}

function CctvPreview({ station }: { station: CctvStation }) {
  const [camera, setCamera] = useState<string>(station.cameras[0]);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const imageKey = `${camera}:${version}`;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setVersion((value) => value + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return <section className={styles.preview} aria-label={`ภาพกล้อง ${station.code}`}>
    <h2>{station.code} · {station.name}</h2>
    <p className={styles.location}>{station.location}<br />{station.waterway}</p>
    <div className={styles.toolbar}>
      <div aria-label="เลือกมุมกล้อง">{station.cameras.map((name, index) => <button key={name} type="button" aria-pressed={camera === name} onClick={() => setCamera(name)}>กล้อง {index + 1}</button>)}</div>
      <button type="button" aria-label={`อัปเดตภาพ ${station.code}`} onClick={() => setVersion((value) => value + 1)}><RefreshCw size={14} />อัปเดต</button>
    </div>
    <div className={styles.image}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Preserve public snapshot refresh and explicit image errors. */}
      <img key={imageKey} src={`/api/cctv/${camera}/image?v=${version}`} alt={`ภาพนิ่งจากกล้อง ${camera} · ${station.name}`} width={1280} height={720}
        onLoad={() => setLoaded(imageKey)} onError={() => setFailed(imageKey)} hidden={failed === imageKey} />
      {failed === imageKey ? <p role="status">โหลดภาพไม่ได้ ลองอัปเดตหรือเปิดเว็บ ปภ.</p> : loaded !== imageKey && <p className={styles.loading} role="status">กำลังโหลดภาพ…</p>}
    </div>
    <p className={styles.note}>ภาพนิ่ง · ตรวจภาพทุก 1 นาทีขณะเปิดดู<br />ตรวจเวลาที่ประทับบนภาพ ภาพอาจล่าช้าจากต้นทาง</p>
    <DataSource label={`กรมป้องกันและบรรเทาสาธารณภัย · ${station.code}`} url={station.sourceUrl} />
    <a className={styles.original} href={station.sourceUrl} target="_blank" rel="noopener noreferrer">เปิดกล้องบนเว็บ ปภ.</a>
  </section>;
}
