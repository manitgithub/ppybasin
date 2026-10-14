"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ClipboardList, Home, Layers, LogIn, Navigation, Phone, Plus, Waves } from "lucide-react";
import { DataSources } from "@/components/DataSource";
import PublicSituationSummary from "./PublicSituationSummary";
import type { SituationPayload } from "@/lib/situation/adapters";
import { localRain, localStations } from "@/lib/public-situation";
import type { PublicAlert } from "./PublicDashboard";
import styles from "./PublicMapHome.module.css";

const BasinMap = dynamic(() => import("@/components/BasinMap"), {
  ssr: false,
  loading: () => <div className={styles.loading} role="status">กำลังเปิดแผนที่ลุ่มน้ำป่าพะยอม…</div>,
});

export default function PublicMapHome({ alerts, loading, errors, loginError, navigate, nearby = false, signedIn = false, situation, now, onRefresh }: {
  situation: SituationPayload | null;
  now: number;
  onRefresh: () => void;
  nearby?: boolean;
  signedIn?: boolean;
  alerts: PublicAlert[];
  loading: boolean;
  errors: string[];
  loginError: string;
  navigate: (tab: "home" | "map" | "nearby" | "report" | "mine") => void;
}) {
  const [layers, setLayers] = useState({ waterways: true, stations: true, shelters: true, alerts: true, boundary: true, rain: true, waterLevels: true });
  const layerOptions = [
    { id: "waterways", label: "เส้นทางน้ำ", note: "แม่น้ำ / คลอง / ทางน้ำย่อย", color: "#1988c6" },
    { id: "stations", label: "สถานีตรวจวัด", note: "กดหมุดเพื่อดูรายละเอียดสถานี", color: "#2563eb" },
    { id: "rain", label: "ฝนสะสม 24 ชั่วโมง", note: "สถานีฝน · ป่าพะยอม / ควนขนุน", color: "#087e96" },
    { id: "waterLevels", label: "ระดับน้ำล่าสุด", note: "ค่าตรวจวัดจาก ThaiWater", color: "#464ba5" },
    { id: "shelters", label: "ศูนย์อพยพ", note: "สถานะเปิด–ปิดตามทะเบียน", color: "#15803d" },
    { id: "alerts", label: "ประกาศที่ยืนยันแล้ว", note: loading ? "กำลังตรวจสอบประกาศ…" : errors.includes("ประกาศยืนยัน") ? "ยังอ่านประกาศไม่ได้" : `${alerts.length} ประกาศที่มีผลอยู่`, color: "#a66e16" },
    { id: "boundary", label: "ขอบเขตลุ่มน้ำ", note: "ลุ่มน้ำป่าพะยอม", color: "#128b87" },
  ] as const;

  return <div className={styles.root}>
    <header className={styles.header}>
      <Link href="/#home" className={styles.brand}><Waves size={28} /><span>ป่าพะยอม<strong>SMART BASIN</strong></span></Link>
      <h1>{nearby ? "ศูนย์อพยพใกล้ฉัน" : "แผนที่ติดตามสถานการณ์"}</h1>
      <div className={styles.actions}>
        <a href="tel:1784" aria-label="โทร ปภ. 1784"><Phone size={17} /><span>1784</span></a>
        <a href={signedIn ? "/api/auth/logout" : "/api/auth/line/start"}><LogIn size={17} />{signedIn ? "ออกจากระบบ" : "เข้าสู่ระบบ"}</a>
      </div>
    </header>
    <main className={`${styles.map} ${nearby ? styles.nearby : styles.withSituation}`} aria-label="แผนที่ลุ่มน้ำป่าพะยอม">
      <BasinMap rainStations={localRain(situation, "rain24h")} waterLevels={localStations(situation?.thaiWater.waterLevels ?? [])} showRain={layers.rain} showWaterLevels={layers.waterLevels} now={now} showWaterways={layers.waterways} showStations={layers.stations} nearby={nearby} showShelters={nearby || layers.shelters} showAlerts={layers.alerts} showBoundary={layers.boundary} alerts={alerts} />
      <details className={styles.layers} open={!nearby}>
        <summary><span><Layers size={18} />ชั้นข้อมูล</span><ChevronDown size={16} /></summary>
        <div className={styles.layerOptions}>
          {layerOptions.map(({ id, label, note, color }) => <label key={id} className={styles.layer}>
            <input type="checkbox" checked={layers[id]} onChange={(event) => setLayers((current) => ({ ...current, [id]: event.target.checked }))} />
            <span className={styles.swatch} style={{ backgroundColor: color }} aria-hidden="true" />
            <span>{label}<small>{note}</small></span>
          </label>)}
        </div>
      </details>
      {!nearby && <PublicSituationSummary situation={situation} now={now} loading={loading} failed={errors.includes("ข้อมูลตรวจวัด")} onRefresh={onRefresh} />}
      {loginError && <p className={styles.error} role="alert">{loginError}</p>}
      <details className={styles.sources}>
        <summary>แหล่งข้อมูลและข้อควรทราบ <ChevronDown size={14} /></summary>
        <div className={styles.sourceContent}>
          <p>ศูนย์อพยพแสดงสถานะตามทะเบียน ควรยืนยันการเปิดและที่ว่างกับเจ้าหน้าที่ก่อนเดินทาง ไม่มีประกาศไม่ได้ยืนยันว่าไม่มีน้ำท่วม</p>
          <DataSources sources={[
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
      <nav className={styles.nav} aria-label="เมนูหลัก">
        <button type="button" aria-current={!nearby ? "page" : undefined} onClick={() => navigate("home")}><Home size={19} /><span>หน้าหลัก</span></button>
        <button type="button" aria-current={nearby ? "page" : undefined} onClick={() => navigate("nearby")}><Navigation size={19} /><span>ศูนย์ใกล้ฉัน</span></button>
        <button type="button" onClick={() => navigate("report")}><Plus size={20} /><span>แจ้งเหตุ</span></button>
        <button type="button" onClick={() => navigate("mine")}><ClipboardList size={19} /><span>รายงานของฉัน</span></button>
      </nav>
    </main>
  </div>;
}
