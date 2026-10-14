"use client";

import { ChevronDown, CloudRain, RefreshCw, Waves } from "lucide-react";
import DataSource from "@/components/DataSource";
import type { SituationPayload } from "@/lib/situation/adapters";
import { isRecentObservation, localRain, localStations, observationLabel } from "@/lib/public-situation";
import styles from "./PublicMapHome.module.css";

export default function PublicSituationSummary({ situation, loading, failed, now, onRefresh }: {
  situation: SituationPayload | null; loading: boolean; failed: boolean; now: number; onRefresh: () => void;
}) {
  const rain24 = localRain(situation, "rain24h");
  const rain72 = localRain(situation, "rain72h");
  const highest = (stations: typeof rain24) => stations.find((station) => isRecentObservation(station.observedAt, now));
  const reservoir = situation?.reservoir;
  const storage = reservoir?.status === "ok" && Number.isFinite(reservoir.capacityPercent) ? reservoir.capacityPercent : null;
  const waters = localStations(situation?.thaiWater.waterLevels ?? []);
  const empty = loading && !situation ? "กำลังโหลด…" : "ข้อมูลไม่พร้อม";
  return <section className={styles.situation} aria-label="ฝนและน้ำในพื้นที่">
    <div className={styles.situationHeading}><h2><CloudRain size={17} />ฝนและน้ำในพื้นที่</h2><button type="button" disabled={loading} onClick={onRefresh} aria-label="อัปเดตข้อมูลฝนและน้ำ"><RefreshCw size={14} />{loading ? "กำลังอัปเดต" : "อัปเดต"}</button></div>
    {failed && <p className={styles.situationWarning} role="status">อัปเดตไม่สำเร็จ{ situation ? " · แสดงข้อมูลที่โหลดไว้ก่อนหน้า" : " · ลองอัปเดตอีกครั้ง"}</p>}
    <div className={styles.metrics}>
      {([{ label: "ฝนสะสม 24 ชม.", stations: rain24 }, { label: "ฝนสะสม 72 ชม.", stations: rain72 }]).map(({ label, stations }) => {
        const station = highest(stations);
        return <div key={label}><span>{label}</span><strong>{station ? <>{station.rainfallMm.toLocaleString("th-TH", { maximumFractionDigits: 1 })}<small> มม.</small></> : empty}</strong><p>{station ? `สูงสุด · ${station.name}` : stations.length ? "มีเฉพาะข้อมูลเก่า" : "ป่าพะยอม / ควนขนุน"}</p>{station && <time>{observationLabel(station.observedAt)}</time>}</div>;
      })}
      <div><span>น้ำในอ่างป่าพะยอม</span><strong>{storage === null ? empty : <>{storage.toLocaleString("th-TH", { maximumFractionDigits: 1 })}<small> %</small></>}</strong><p>ของความจุเก็บกัก</p>{reservoir?.latestDataDate && <small>ข้อมูลวันที่ {reservoir.latestDataDate}</small>}</div>
    </div>
    <details className={styles.situationDetails}>
      <summary>ระดับน้ำ พยากรณ์ และรายละเอียดฝน <ChevronDown size={14} /></summary>
      <div className={styles.situationContent}>
        <p>ฝนสูงสุดจากสถานีในอำเภอป่าพะยอมและควนขนุน ไม่ใช่ค่าเฉลี่ยทั้งลุ่มน้ำ · ใช้ข้อมูลตรวจวัดไม่เกิน 3 ชั่วโมง หรือข้อมูลรายวันที่ระบุวันที่วันนี้ · ตรวจแหล่งข้อมูลทุก 5 นาที</p>
        {situation && <p>ตรวจแหล่งข้อมูล {observationLabel(situation.updatedAt)}</p>}
        {([{ title: "ฝนสะสม 24 ชั่วโมง", stations: rain24, source: "thaiwater-rain24h" }, { title: "ฝนสะสม 72 ชั่วโมง", stations: rain72, source: "thaiwater-rain72h" }]).map(({ title, stations, source }) => <section key={source}><h3>{title}</h3>{stations.length ? stations.map((station) => <article key={station.id}><b>{station.name} · {station.district}</b><span>{station.rainfallMm.toLocaleString("th-TH")} มม.</span><small>{observationLabel(station.observedAt)}{!isRecentObservation(station.observedAt, now) && " · ข้อมูลเก่าหรือเวลาไม่พร้อม"}</small></article>) : <p>{empty} · ยังไม่มีค่าตรวจวัดในพื้นที่ที่อ่านได้</p>}<Source situation={situation} id={source} /></section>)}
        <section><h3><Waves size={15} />ระดับน้ำล่าสุด</h3>{waters.length ? waters.map((station) => <article key={station.id}><b>{station.name}</b><span>{station.waterLevelMsl !== null ? `${station.waterLevelMsl.toFixed(2)} ม.รทก.` : station.waterLevelM !== null ? `${station.waterLevelM.toFixed(2)} ม. (ระดับน้ำตามสถานี)` : "ข้อมูลไม่พร้อม"}</span><small>{observationLabel(station.observedAt)}{!isRecentObservation(station.observedAt, now) && " · ข้อมูลเก่าหรือเวลาไม่พร้อม"}</small></article>) : <p>{empty}</p>}<Source situation={situation} id="thaiwater-waterlevel" /></section>
        <section><h3>อ่างเก็บน้ำป่าพะยอม</h3><p>{storage === null ? empty : `น้ำในอ่าง ${storage.toLocaleString("th-TH")} %`}{reservoir?.latestDataDate ? ` · ข้อมูลวันที่ ${reservoir.latestDataDate}` : ""}</p>{reservoir?.status === "ok" && <p>น้ำไหลเข้า {reservoir.inflowMcm ?? "—"} · ระบายออก {reservoir.outflowMcm ?? "—"} ล้าน ลบ.ม.</p>}<Source situation={situation} id="rid-reservoir" /></section>
        <section><h3>พยากรณ์อากาศ · ภาคใต้ฝั่งตะวันออก</h3><p>ข้อมูลระดับภูมิภาค ไม่ใช่พยากรณ์เฉพาะป่าพะยอม</p>{[situation?.tmd.daily, situation?.tmd.sevenDay].map((forecast, index) => <div key={index}><b>{index === 0 ? "24 ชั่วโมง" : "แนวโน้ม 7 วัน"}</b><p>{forecast?.status === "ok" ? forecast.evidence : empty}</p>{forecast && <DataSource label="กรมอุตุนิยมวิทยา" url={forecast.sourceUrl} />}</div>)}</section>
      </div>
    </details>
  </section>;
}

function Source({ situation, id }: { situation: SituationPayload | null; id: string }) {
  const source = situation?.sources.find((item) => item.id === id);
  return source ? <DataSource label={source.label} url={source.url} /> : null;
}
