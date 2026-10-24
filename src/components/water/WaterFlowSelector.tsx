"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ChevronDown, Search, Waves } from "lucide-react";
import { catalogStations, type CatalogStation } from "@/lib/station-catalog";
import type { SituationPayload } from "@/lib/situation/adapters";
import { latestWater, waterStations, waterTime, type WaterSeries } from "@/lib/water/series";
import { rainZoneLabels } from "@/lib/rain-stations";
import { waterDate, waterValue } from "./WaterChart";
import styles from "./WaterFlowSelector.module.css";

const lanes = [
  { id: "pa-phayom", name: "ลุ่มน้ำป่าพะยอม", description: "อ่างเก็บน้ำและฝนต้นน้ำ → ฝายบ้านพร้าว → บ้านแหลมโตนด", stages: [["RES-PYP"], ["STN0080"], ["TSL11"], ["FOP038"]] },
  { id: "tha-nae", name: "คลองท่าแนะ", description: "บ้านเขาปู่ → ประตูระบายน้ำคลองท่าแนะ → ตอนล่าง → ทะเลน้อย", stages: [["X.276", "TX276"], ["TSL12"], ["X.277"], ["TX83"]] },
];

export default function WaterFlowSelector({ selectedCode, onSelect, series, zone, onZone, query, onQuery, revision }: {
  selectedCode: string; onSelect: (code: string) => void;
  series: Record<string, WaterSeries | null | undefined>;
  zone: string; onZone: (zone: string) => void; query: string; onQuery: (query: string) => void; revision: number;
}) {
  const [situation, setSituation] = useState<SituationPayload | null>(null);
  const [contextFailed, setContextFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/situation", { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error("Situation unavailable");
      return response.json();
    }).then(payload => { if (!controller.signal.aborted) { setSituation(payload); setContextFailed(false); } })
      .catch(() => { if (!controller.signal.aborted) setContextFailed(true); });
    return () => controller.abort();
  }, [revision]);
  const catalog = catalogStations(situation);
  const needle = query.trim().toLocaleLowerCase("th-TH");
  const stationFor = (code: string) => waterStations.find(item => item.code === code) ?? catalog.find(item => item.code === code);
  const matches = (code: string) => { const station = stationFor(code); return station && `${code} ${station.name}`.toLocaleLowerCase("th-TH").includes(needle); };
  const visibleLanes = lanes.filter(lane => (zone === "all" || zone === lane.id) && lane.stages.flat().some(matches));
  const others = waterStations.filter(station => !lanes.some(lane => lane.stages.flat().includes(station.code)) && (zone === "all" || zone === station.zone) && matches(station.code));
  const context = ["RES-PYP", "STN0080"].includes(selectedCode) ? catalog.find(station => station.code === selectedCode) : null;

  function stationButton(code: string) {
    const station = stationFor(code);
    if (!station) return null;
    const water = latestWater(series[code]?.rows ?? [], "h"), flow = latestWater(series[code]?.rows ?? [], "q");
    const snapshot = catalog.find(item => item.code === code);
    const contextual = code === "RES-PYP" || code === "STN0080";
    const reading = code === "RES-PYP" ? `น้ำในอ่าง ${waterValue(snapshot?.reservoirReading?.capacityPercent)}%`
      : code === "STN0080" ? `ฝน 24 ชม. ${waterValue(snapshot?.rainReading?.rainfallMm)} มม.`
        : water ? `ระดับ ${waterValue(water.h)} ${"unit" in station ? station.unit : "ม."}` : series[code] === undefined ? "กำลังอ่านข้อมูล…" : "ยังไม่มีค่าระดับน้ำ";
    return <button key={code} type="button" className={styles.station} title={`${code} · ${station.name}${water ? ` · ${waterDate(water.t)}` : ""}`} aria-pressed={selectedCode === code} onClick={() => onSelect(code)}>
      <span className={styles.stationTop}><b>{code}</b>{selectedCode === code && <span>เลือกอยู่</span>}</span>
      <strong>{station.name}</strong><small>{reading}</small>
      {flow && <small>น้ำท่า {waterValue(flow.q)} ลบ.ม./วินาที</small>}
      {!contextual && water && <time dateTime={new Date(water.t).toISOString()}>{waterDate(water.t)}</time>}
      <span className={styles.action}>{contextual ? "ดูข้อมูลต้นน้ำ" : "ดูกราฟย้อนหลัง"}<ArrowRight size={12} aria-hidden="true" /></span>
    </button>;
  }

  return <section className={styles.selector} aria-label="เลือกสถานีตามแนวทางน้ำ">
    <header className={styles.heading}><div><p><Waves size={16} />เลือกสถานีตามแนวทางน้ำ</p><h2>สองลุ่มน้ำ แยกติดตามชัดเจน</h2></div><span>กดสถานีเพื่อดูข้อมูลด้านล่าง</span></header>
    <div className={styles.filters}>
      <label className={styles.search}><Search size={16} /><input aria-label="ค้นหาสถานีระดับน้ำ" placeholder="ค้นหารหัสหรือชื่อสถานี" value={query} onChange={event => onQuery(event.target.value)} /></label>
      <label>พื้นที่ติดตาม<select aria-label="พื้นที่ติดตามน้ำ" value={zone} onChange={event => onZone(event.target.value)}><option value="all">ทุกพื้นที่</option>{Object.entries(rainZoneLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    <div className={styles.lanes}>
      {visibleLanes.map(lane => <section key={lane.id} className={styles.lane} data-water-lane={lane.id}>
        <header className={styles.laneHeader}><span className={styles.number}>{lane.id === "pa-phayom" ? "1" : "2"}</span><div><h3>{lane.name}</h3><p>{lane.description}</p><span>ต้นน้ำ <ArrowRight size={13} /> ปลายน้ำ</span></div></header>
        <ol className={styles.stages}>{lane.stages.map((codes, i) => <li key={codes[0]} className={styles.stage}>
          {i > 0 && <span className={styles.connector} aria-hidden="true"><ArrowRight className={styles.horizontalArrow} size={18} /><ArrowDown className={styles.verticalArrow} size={18} /></span>}
          <div className={styles.stageContent} data-matched={!needle || codes.some(matches)}>
            {codes.length > 1 && <p className={styles.sharedPoint}>บ้านเขาปู่ · ข้อมูล 2 แหล่ง</p>}
            {codes.map(stationButton)}
          </div>
        </li>)}</ol>
      </section>)}
      {!!others.length && <details key={`${zone}:${needle}`} className={styles.others} open={zone === "nearby" || Boolean(needle)}><summary><span>สถานีข้างเคียงและสถานีประวัติ <small>{others.length} แห่ง</small></span><ChevronDown size={16} /></summary><p>เลือกดูกราฟเพิ่มเติม แสดงแยกจากสองแนวทางน้ำด้านบน</p><div>{others.map(station => stationButton(station.code))}</div><p className={styles.note}>ลูกศรแสดงลำดับพื้นที่ติดตามจากต้นน้ำสู่ปลายน้ำ ไม่ใช่ทิศทางการไหลที่ตรวจวัดหรือเวลาเดินทางของน้ำ · สถานีวัดฝนใช้ประกอบการติดตามพื้นที่ต้นน้ำ</p></details>}
      {!visibleLanes.length && !others.length && <p className={styles.empty}>ไม่พบสถานีที่ตรงกับคำค้น</p>}
    </div>
    {context && <ContextDetails station={context} failed={contextFailed} />}
  </section>;
}

function ContextDetails({ station, failed }: { station: CatalogStation; failed: boolean }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }, [station.code]);
  const reservoir = station.reservoirReading, rain = station.rainReading;
  const observed = station.reservoir ? reservoir?.latestDataDate : rain?.observedAt;
  const readings = station.reservoir ? [
    ["น้ำในอ่าง", reservoir?.capacityPercent, "% ของความจุ"], ["ปริมาตรน้ำ", reservoir?.storageMcm, "ล้าน ลบ.ม."],
    ["น้ำไหลเข้า", reservoir?.inflowMcm, "ล้าน ลบ.ม."], ["ระบายออก", reservoir?.outflowMcm, "ล้าน ลบ.ม."],
  ] as const : [["ฝนสะสม 24 ชั่วโมง", rain?.rainfallMm, "มม."]] as const;
  return <section ref={panel} className={styles.context} aria-label={`ข้อมูลต้นน้ำ ${station.code}`}>
    <header><p>{station.code} · ข้อมูลต้นน้ำที่เลือก</p><h3>{station.name}</h3></header>
    <dl>{readings.map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{waterValue(value)} <small>{unit}</small></dd></div>)}</dl>
    <p>{observed ? `เวลาข้อมูล ${waterDate(waterTime(observed), !/^\d{4}-\d{2}-\d{2}$/.test(observed))}` : failed ? "ยังอ่านข้อมูลต้นทางไม่ได้ กรุณากดอัปเดตข้อมูลเพื่อลองใหม่" : "ยังไม่มีข้อมูลที่ยืนยันได้"}</p>
    <p>เลือกสถานีระดับน้ำในผังเพื่อดูกราฟระดับน้ำ–น้ำท่าย้อนหลัง</p>
    <a href={station.reservoir ? reservoir?.sourceUrl ?? "https://app.rid.go.th/reservoir/" : rain?.sourceUrl ?? "https://www.thaiwater.net/"} target="_blank" rel="noopener noreferrer">แหล่งข้อมูล · {station.reservoir ? "กรมชลประทาน" : station.agency} ↗</a>
  </section>;
}
