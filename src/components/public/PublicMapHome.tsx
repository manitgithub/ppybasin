"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown, ClipboardList, Home, Layers, LogIn, Navigation, Phone, Plus, Sun, Waves } from "lucide-react";
import { cctvStations } from "@/lib/cctv-stations";
import { BASIN_MARKER_HTML } from "@/lib/basin-map-symbols";
import { DataSources } from "@/components/DataSource";
import useRainViewer from "./useRainViewer";
import RainViewerControls from "./RainViewerControls";
import PublicSituationSummary from "./PublicSituationSummary";
import type { SituationPayload } from "@/lib/situation/adapters";
import { localRain, localStations } from "@/lib/public-situation";
import type { PublicAlert } from "./PublicDashboard";
import styles from "./PublicMapHome.module.css";

const BasinMap = dynamic(() => import("@/components/BasinMap"), {
  ssr: false,
  loading: () => <div className={styles.loading} role="status">กำลังเปิดแผนที่ลุ่มน้ำป่าพะยอม…</div>,
});

export default function PublicMapHome({ alerts, loading, errors, loginError, navigate, nearby = false, signedIn = false, situation, now, onRefresh, embedded = false }: {
  embedded?: boolean;
  situation: SituationPayload | null;
  now: number;
  onRefresh: () => void;
  nearby?: boolean;
  signedIn?: boolean;
  alerts: PublicAlert[];
  loading: boolean;
  errors: string[];
  loginError: string;
  navigate: (tab: "home" | "map" | "nearby" | "report" | "mine" | "drought") => void;
}) {
  const [layers, setLayers] = useState({ waterways: true, stations: true, shelters: true, alerts: true, boundary: true, rain: true, waterLevels: true, radar: !nearby, cctv: true });
  const [focusedCctv, setFocusedCctv] = useState<{ code: string; revision: number } | null>(null);
  const radar = useRainViewer(layers.radar);
  const layerOptions = [
    { id: "radar", label: "เรดาร์ฝน · RainViewer", note: "ภาพกลุ่มฝนย้อนหลัง 2 ชั่วโมง", color: "#147ab5" },
    { id: "waterways", label: "เส้นทางน้ำ", note: "แม่น้ำ / คลอง / ทางน้ำย่อย", color: "#1988c6" },
    { id: "cctv", label: "กล้อง ปภ. / กรมชลประทาน", note: `${cctvStations.length} จุด · กดเลือกเพื่อดูภาพและเวลาต้นทาง`, color: "#475569" },
    { id: "stations", label: "สถานีตรวจวัด", note: "กดหมุดเพื่อดูรายละเอียดสถานี", color: "#2563eb" },
    { id: "rain", label: "ฝนสะสม 24 ชั่วโมง", note: "สถานีฝน · ป่าพะยอม / ควนขนุน", color: "#087e96" },
    { id: "waterLevels", label: "ระดับน้ำล่าสุด", note: "ค่าตรวจวัดจาก ThaiWater", color: "#464ba5" },
    { id: "shelters", label: "ศูนย์อพยพ", note: "สถานะเปิด–ปิดตามทะเบียน", color: "#15803d" },
    { id: "alerts", label: "ประกาศที่ยืนยันแล้ว", note: loading ? "กำลังตรวจสอบประกาศ…" : errors.includes("ประกาศยืนยัน") ? "ยังอ่านประกาศไม่ได้" : `${alerts.length} ประกาศที่มีผลอยู่`, color: "#a66e16" },
    { id: "boundary", label: "ขอบเขตลุ่มน้ำ", note: "ลุ่มน้ำป่าพะยอม", color: "#128b87" },
  ] as const;

  return <div className={`${styles.root} ${embedded ? styles.embedded : ""}`}>
    {!embedded && <header className={styles.header}>
      <Link href="/#home" className={styles.brand}><Waves size={28} /><span>ป่าพะยอม<strong>SMART BASIN</strong></span></Link>
      <h1>{nearby ? "ศูนย์อพยพใกล้ฉัน" : "แผนที่ติดตามสถานการณ์"}</h1>
      <div className={styles.actions}>
        <a href="tel:1784" aria-label="โทร ปภ. 1784"><Phone size={17} /><span>1784</span></a>
        <a href={signedIn ? "/api/auth/logout" : "/api/auth/line/start"}><LogIn size={17} />{signedIn ? "ออกจากระบบ" : "เข้าสู่ระบบ"}</a>
      </div>
    </header>}
    <main className={`${styles.map} ${nearby ? styles.nearby : styles.withSituation}`} aria-label="แผนที่ลุ่มน้ำป่าพะยอม">
      <BasinMap focusedCctv={focusedCctv} showCctv={layers.cctv} radar={radar.overlay} onRadarTileError={radar.onTileError} rainStations={localRain(situation, "rain24h")} waterLevels={localStations(situation?.thaiWater.waterLevels ?? [])} showRain={layers.rain} showWaterLevels={layers.waterLevels} now={now} showWaterways={layers.waterways} showStations={layers.stations} nearby={nearby} showShelters={nearby || layers.shelters} showAlerts={layers.alerts} showBoundary={layers.boundary} alerts={alerts} />
      <details className={styles.layers} open={!nearby}>
        <summary><span><Layers size={18} />ชั้นข้อมูล</span><ChevronDown size={16} /></summary>
        <div className={styles.layerOptions}>
          {layerOptions.map(({ id, label, note, color }) => <Fragment key={id}><label className={styles.layer}>
            <input type="checkbox" checked={layers[id]} onChange={(event) => setLayers((current) => ({ ...current, [id]: event.target.checked }))} />
            <LayerSymbol id={id} color={color} />
            <span>{label}<small>{note}</small></span>
          </label>{id === "cctv" && layers.cctv && <div className={styles.cctvLinks}>{cctvStations.map((station) => <button key={station.code} type="button" onClick={(event) => {
            setFocusedCctv((current) => ({ code: station.code, revision: (current?.revision ?? 0) + 1 }));
            const panel = event.currentTarget.closest("details");
            if (panel) panel.open = false;
          }}>ดู {station.code} · {station.name} ({station.providerLabel})</button>)}</div>}{id === "radar" && layers.radar && <RainViewerControls radar={radar} now={now} />}</Fragment>)}
        </div>
      </details>
      {!nearby && <PublicSituationSummary situation={situation} now={now} loading={loading} failed={errors.includes("ข้อมูลตรวจวัด")} onRefresh={onRefresh} />}
      {loginError && <p className={styles.error} role="alert">{loginError}</p>}
      <details className={styles.sources}>
        <summary>แหล่งข้อมูลและข้อควรทราบ <ChevronDown size={14} /></summary>
        <div className={styles.sourceContent}>
          <p>ศูนย์อพยพแสดงสถานะตามทะเบียน ควรยืนยันการเปิดและที่ว่างกับเจ้าหน้าที่ก่อนเดินทาง ไม่มีประกาศไม่ได้ยืนยันว่าไม่มีน้ำท่วม</p>
          <DataSources sources={[
            ...cctvStations.map((station) => ({ label: `${station.providerLabel} · กล้อง ${station.code} ${station.name}`, url: station.sourceUrl })),
            { label: "RainViewer · ภาพเรดาร์ฝน", url: "https://www.rainviewer.com/" },
            { label: "Esri · World Topographic Map", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer" },
            { label: "เส้นทางน้ำ · OpenStreetMap contributors", url: "/terrain/pa-phayom-waterways.json" },
            { label: "ขอบเขตลุ่มน้ำป่าพะยอม", url: "/boundaries/pa-phayom-basin.geojson" },
            { label: "ทะเบียนสถานีตรวจวัด", url: "/api/sensor/devices" },
            { label: "ทะเบียนศูนย์อพยพ", url: "/api/shelters" },
            { label: "ประกาศที่เจ้าหน้าที่อนุมัติ", url: "/api/flood-alerts?public=1" },
          ]} />
          <Link href="/privacy">ความเป็นส่วนตัว</Link>
        </div>
      </details>
      {!embedded && <nav className={styles.nav} aria-label="เมนูหลัก">
        <button type="button" aria-current={!nearby ? "page" : undefined} onClick={() => navigate("home")}><Home size={19} /><span>หน้าหลัก</span></button>
        <button type="button" onClick={() => navigate("drought")}><Sun size={19} /><span>เฝ้าระวังภัยแล้ง</span></button>
        <button type="button" aria-current={nearby ? "page" : undefined} onClick={() => navigate("nearby")}><Navigation size={19} /><span>ศูนย์ใกล้ฉัน</span></button>
        <button type="button" onClick={() => navigate("report")}><Plus size={20} /><span>แจ้งเหตุ</span></button>
        <button type="button" onClick={() => navigate("mine")}><ClipboardList size={19} /><span>รายงานของฉัน</span></button>
      </nav>}
    </main>
  </div>;
}

function LayerSymbol({ id, color }: { id: string; color: string }) {
  if (id === "stations" || id === "rain" || id === "shelters" || id === "cctv") {
    return <span className={styles.layerMarker} aria-hidden="true" dangerouslySetInnerHTML={{ __html: BASIN_MARKER_HTML[id] }} />;
  }
  return <svg className={styles.layerSymbol} viewBox="0 0 32 32" aria-hidden="true">
    {id === "radar" ? <><circle cx="16" cy="16" r="12" stroke={color} strokeWidth="2" fill={color} fillOpacity=".12" /><circle cx="16" cy="16" r="6" stroke={color} fill="none" /><path d="M16 16 25 7M16 4v3M4 16h3M16 25v3M25 16h3" stroke={color} strokeWidth="2" /></>
      : id === "waterLevels" ? <circle cx="16" cy="16" r="9" stroke={color} strokeWidth="2" fill="#d6d8fa" fillOpacity=".9" />
      : id === "alerts" ? <circle cx="16" cy="16" r="12" stroke="#ac7415" strokeWidth="3" fill="#ac7415" fillOpacity=".3" />
      : id === "boundary" ? <rect x="4" y="5" width="24" height="22" rx="3" stroke={color} strokeWidth="2" strokeDasharray="6 4" fill={color} fillOpacity=".06" />
      : <><path d="M3 26C5 14 25 22 23 11S29 6 29 4" fill="none" stroke="#ffffff" strokeWidth="7" /><path d="M3 26C5 14 25 22 23 11S29 6 29 4" fill="none" stroke="#006bb6" strokeWidth="4" strokeLinecap="round" /></>}
  </svg>;
}
