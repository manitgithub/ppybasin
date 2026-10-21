"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useCallback, useState } from "react";
import { GIS_SOURCE_URL, gisLayers, landuseLegend, type GisLayerStatus } from "@/lib/gis-layers";
import { Camera, ChevronDown, ClipboardList, CloudRain, Home, Layers, LogIn, Navigation, Phone, Plus, Sun, Waves } from "lucide-react";
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
  const [layers, setLayers] = useState({ waterways: true, stations: true, shelters: true, alerts: true, boundary: true, thanaeBoundary: false, rain: true, waterLevels: true, radar: !nearby, cctv: true });
  const [boundaryViewRevision, setBoundaryViewRevision] = useState(0);
  const [focusedCctv, setFocusedCctv] = useState<{ code: string; revision: number } | null>(null);
  const [gisSelected, setGisSelected] = useState<string[]>([]);
  const [gisStatus, setGisStatus] = useState<Record<string, GisLayerStatus>>({});
  const onGisStatus = useCallback((id: string, status: GisLayerStatus) => setGisStatus(current => current[id] === status ? current : { ...current, [id]: status }), []);
  const radar = useRainViewer(layers.radar);
  const layerOptions = [
    { id: "radar", label: "เรดาร์ฝน · RainViewer", note: "ภาพกลุ่มฝนย้อนหลัง 2 ชั่วโมง", color: "#147ab5" },
    { id: "waterways", label: "เส้นทางน้ำ", note: "แม่น้ำ / คลอง / ทางน้ำย่อย", color: "#1988c6" },
    { id: "cctv", label: "กล้อง ปภ. / กรมชลประทาน", note: `${cctvStations.length} จุด · เลือกดูภาพจากแผงดูกล้อง CCTV`, color: "#475569" },
    { id: "stations", label: "สถานีตรวจวัด", note: "กดหมุดเพื่อดูรายละเอียดสถานี", color: "#2563eb" },
    { id: "rain", label: "สถานีวัดน้ำฝน", note: "ThaiWater 24 ชม. / EWS 12 ชม. ใกล้ป่าพะยอม", color: "#087e96" },
    { id: "waterLevels", label: "ระดับน้ำล่าสุด", note: "ค่าตรวจวัดจาก ThaiWater", color: "#464ba5" },
    { id: "shelters", label: "ศูนย์อพยพ", note: "สถานะเปิด–ปิดตามทะเบียน", color: "#15803d" },
    { id: "alerts", label: "ประกาศที่ยืนยันแล้ว", note: loading ? "กำลังตรวจสอบประกาศ…" : errors.includes("ประกาศยืนยัน") ? "ยังอ่านประกาศไม่ได้" : `${alerts.length} ประกาศที่มีผลอยู่`, color: "#a66e16" },
    { id: "boundary", label: "ขอบเขตลุ่มน้ำป่าพะยอม", note: "เน้นพื้นที่และซูมตามลุ่มน้ำที่เลือก", color: "#128b87" },
    { id: "thanaeBoundary", label: "ขอบเขตลุ่มน้ำคลองท่าแนะ", note: layers.thanaeBoundary ? gisStatus.thanae_basin === "error" ? "โหลดไม่ได้ · ปิดแล้วเปิดเพื่อลองใหม่" : gisStatus.thanae_basin === "ready" ? "เน้นพื้นที่และซูมตามลุ่มน้ำที่เลือก" : "กำลังโหลดขอบเขต…" : "เลือกแยกหรือแสดงพร้อมป่าพะยอมได้", color: "#a35f9f" },
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
    <main className={`${styles.map} ${nearby ? styles.nearby : styles.withSituation}`} aria-label="แผนที่ลุ่มน้ำป่าพะยอมและคลองท่าแนะ">
      <BasinMap showThaNaeBoundary={layers.thanaeBoundary} boundaryViewRevision={boundaryViewRevision} gisSelected={gisSelected} onGisStatus={onGisStatus} focusedCctv={focusedCctv} showCctv={layers.cctv} radar={radar.overlay} onRadarTileError={radar.onTileError} rainStations={[...localRain(situation, "rain24h"), ...(situation?.dwr?.rain12h ?? [])]} waterLevels={localStations(situation?.thaiWater.waterLevels ?? [])} showRain={layers.rain} showWaterLevels={layers.waterLevels} now={now} showWaterways={layers.waterways} showStations={layers.stations} nearby={nearby} showShelters={nearby || layers.shelters} showAlerts={layers.alerts} showBoundary={layers.boundary} alerts={alerts} />
      <details className={styles.layers} open={!nearby}>
        <summary><span><Layers size={18} />ชั้นข้อมูล</span><ChevronDown size={16} /></summary>
        <div className={styles.layerOptions}>
          {layerOptions.map(({ id, label, note, color }) => <Fragment key={id}><label className={styles.layer}>
            <input type="checkbox" checked={layers[id]} onChange={(event) => setLayers((current) => ({ ...current, [id]: event.target.checked }))} />
            <LayerSymbol id={id} color={color} />
            <span>{label}<small>{note}</small></span>
          </label></Fragment>)}
          <div className={styles.basinView}><button type="button" onClick={() => {
            setLayers(current => ({ ...current, boundary: true, thanaeBoundary: true }));
            setBoundaryViewRevision(current => current + 1);
          }}>ดูทั้ง 2 ลุ่มน้ำ</button><p>เลือกขอบเขตได้พร้อมกัน พื้นที่นอกลุ่มน้ำที่เลือกจะแสดงจางลง</p></div>
          <div className={styles.gisIntro}><strong>ข้อมูล GIS เพิ่มเติม</strong><p>เปิดเพื่อโหลดข้อมูลและกดบนแผนที่เพื่อดูรายละเอียด ข้อมูลความเสี่ยงไม่ใช่ประกาศเตือนปัจจุบัน</p></div>
          {[...new Set(gisLayers.map(def => def.group))].map(group => <fieldset key={group} className={styles.gisGroup}>
            <legend>{group}</legend>
            {gisLayers.filter(def => def.group === group).map(def => <Fragment key={def.id}>
              <label className={styles.layer}>
                <input type="checkbox" checked={gisSelected.includes(def.id)} onChange={event => setGisSelected(current => event.target.checked ? [...current, def.id] : current.filter(id => id !== def.id))} />
                <svg className={styles.layerSymbol} viewBox="0 0 32 32" aria-hidden="true">{def.point ? <circle cx="16" cy="16" r="7" fill={def.color} stroke="white" strokeWidth="2" /> : <rect x="5" y="6" width="22" height="20" rx="2" stroke={def.color} strokeWidth="2" fill={def.color} fillOpacity=".2" />}</svg>
                <span>{def.label}<small>{def.count.toLocaleString("th-TH")} รายการ · {gisSelected.includes(def.id) ? gisStatus[def.id] === "ready" ? "แสดงบนแผนที่แล้ว" : gisStatus[def.id] === "error" ? "โหลดไม่ได้ · ปิดแล้วเปิดเพื่อลองใหม่" : "กำลังโหลด…" : "โหลดเมื่อเลือก"}</small></span>
              </label>
              {def.id === "landuse" && gisSelected.includes(def.id) && <div className={styles.gisLegend}>{landuseLegend.map(item => <span key={item.code}><i style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>}
            </Fragment>)}
          </fieldset>)}
          <p className={styles.gisNote} role="status">{gisSelected.length ? `เลือก GIS ${gisSelected.length} ชั้น · พร้อมแสดง ${gisSelected.filter(id => gisStatus[id] === "ready").length} ชั้น` : "ชั้น GIS ปิดไว้เริ่มต้นเพื่อให้แผนที่อ่านง่าย"}</p>
        </div>
      </details>
      {!nearby && <PublicSituationSummary situation={situation} now={now} loading={loading} failed={errors.includes("ข้อมูลตรวจวัด")} onRefresh={onRefresh} />}
      {loginError && <p className={styles.error} role="alert">{loginError}</p>}
      <div className={styles.mapInfo}>
        <details className={styles.toolPanel}>
          <summary><span><Camera size={18} />ดูกล้อง CCTV · {cctvStations.length} จุด</span><ChevronDown size={16} /></summary>
          <div className={styles.cctvLinks}>{cctvStations.map(station => <button key={station.code} type="button" onClick={event => {
            setLayers(current => ({ ...current, cctv: true }));
            setFocusedCctv(current => ({ code: station.code, revision: (current?.revision ?? 0) + 1 }));
            const panel = event.currentTarget.closest("details");
            if (panel) panel.open = false;
          }}>ดู {station.code} · {station.name} ({station.providerLabel})</button>)}</div>
        </details>
        {layers.radar && <details className={styles.toolPanel}>
          <summary><span><CloudRain size={18} />รายละเอียดเรดาร์ฝน</span><ChevronDown size={16} /></summary>
          <RainViewerControls radar={radar} now={now} />
        </details>}
      <details className={styles.sources}>
        <summary>แหล่งข้อมูลและข้อควรทราบ <ChevronDown size={14} /></summary>
        <div className={styles.sourceContent}>
          <p>ศูนย์อพยพแสดงสถานะตามทะเบียน ควรยืนยันการเปิดและที่ว่างกับเจ้าหน้าที่ก่อนเดินทาง ไม่มีประกาศไม่ได้ยืนยันว่าไม่มีน้ำท่วม</p>
          <DataSources sources={[
            { label: "ชุด GIS · Pa Phayom Water Watch", url: GIS_SOURCE_URL },
            { label: "โฟลเดอร์ข้อมูล GIS ต้นทาง", url: "https://drive.google.com/drive/folders/1aTi0Osd82RebUhDnL5i9brLaOR8wd1c3" },
            ...cctvStations.map((station) => ({ label: `${station.providerLabel} · กล้อง ${station.code} ${station.name}`, url: station.sourceUrl })),
            { label: "RainViewer · ภาพเรดาร์ฝน", url: "https://www.rainviewer.com/" },
            { label: "Esri · World Topographic Map", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer" },
            { label: "เส้นทางน้ำ · OpenStreetMap contributors", url: "/terrain/pa-phayom-waterways.json" },
            { label: "ขอบเขตลุ่มน้ำป่าพะยอม", url: "/boundaries/pa-phayom-basin.geojson" },
            { label: "ขอบเขตลุ่มน้ำคลองท่าแนะ · ชุด GIS", url: "/gis/thanae_basin.geojson" },
            { label: "ทะเบียนสถานีตรวจวัด", url: "/api/sensor/devices" },
            { label: "ทะเบียนศูนย์อพยพ", url: "/api/shelters" },
            { label: "ประกาศที่เจ้าหน้าที่อนุมัติ", url: "/api/flood-alerts?public=1" },
          ]} />
          <p>ข้อมูล GIS คัดลอกจากเว็บอ้างอิงเมื่อ 17 ต.ค. 2569 ไม่ระบุปีสำรวจ ยกเว้นการใช้ที่ดินปี 2563 ตำแหน่งสถานี GIS เป็นข้อมูลอ้างอิง ความเสี่ยงน้ำท่วม–ภัยแล้งไม่ใช่สถานการณ์ปัจจุบัน และบางพื้นที่อยู่นอกลุ่มน้ำป่าพะยอม</p>
          <Link href="/privacy">ความเป็นส่วนตัว</Link>
        </div>
      </details>
      </div>
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
      : (id === "boundary" || id === "thanaeBoundary") ? <rect x="4" y="5" width="24" height="22" rx="3" stroke={color} strokeWidth="2" strokeDasharray="6 4" fill={color} fillOpacity=".06" />
      : <><path d="M3 26C5 14 25 22 23 11S29 6 29 4" fill="none" stroke="#ffffff" strokeWidth="7" /><path d="M3 26C5 14 25 22 23 11S29 6 29 4" fill="none" stroke="#006bb6" strokeWidth="4" strokeLinecap="round" /></>}
  </svg>;
}
