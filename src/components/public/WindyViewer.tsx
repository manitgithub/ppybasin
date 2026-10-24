"use client";

import { useState } from "react";
import { ArrowLeft, Cloud, CloudRain, Droplets, ExternalLink, Wind } from "lucide-react";
import styles from "./WindyViewer.module.css";

export type WindyLayer = "rain" | "rainAccu" | "wind" | "clouds";
const layers = [
  { id: "rain", label: "ฝนพยากรณ์ตามเวลา", icon: CloudRain },
  { id: "rainAccu", label: "ฝนพยากรณ์สะสม", icon: Droplets },
  { id: "wind", label: "ลม", icon: Wind },
  { id: "clouds", label: "เมฆ", icon: Cloud },
] as const;
const forecastSource = "https://embed.windy.com/embed.html?detail=true&detailLat=7.79&detailLon=99.93&embedMake=true&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&type=forecast";

export default function WindyViewer({ initialLayer = "rain", showHeading = true, onBack }: { initialLayer?: WindyLayer; showHeading?: boolean; onBack?: () => void }) {
  const [layer, setLayer] = useState<WindyLayer>(initialLayer);
  const [loaded, setLoaded] = useState(false);
  const params = new URLSearchParams({ embedMake: "true", lat: "7.79", lon: "99.93", zoom: "9", level: "surface", overlay: layer, product: "ecmwf", type: "map", location: "coordinates", metricRain: "mm", metricTemp: "°C", metricWind: "km/h" });
  const source = `https://embed.windy.com/embed.html?${params}`;
  const externalUrl = `https://www.windy.com/?${layer},7.790,99.930,9`;
  const label = layers.find(item => item.id === layer)!.label;
  const hint = layer === "rainAccu" ? "ฝนพยากรณ์สะสม: อ่านช่วงเริ่ม–สิ้นสุดและหน่วยที่ Windy แสดง หากต้องการเปลี่ยนช่วงสะสมเพิ่มเติม ให้เปิด Windy เต็มหน้า"
    : layer === "rain" ? "ฝนพยากรณ์ตามเวลา: เลื่อนแถบเวลาบนแผนที่เพื่อเลือกวัน–เวลาล่วงหน้า และอ่านหน่วยจากคำอธิบายสี"
      : "เลือกวัน–เวลาพยากรณ์จากแถบเวลาบนแผนที่ และอ่านหน่วยตามคำอธิบายสีของ Windy";
  return <section className={`${styles.viewer} ${showHeading ? styles.page : ""}`} aria-label="Windy สภาพอากาศและพยากรณ์">
    {showHeading && <header className={styles.heading}>{onBack && <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} />กลับแผนที่</button>}<p className={styles.eyebrow}>ป่าพะยอมและภาคใต้ · WEATHER OUTLOOK</p><h1>Windy · สภาพอากาศและพยากรณ์</h1><p>เลือกฝน ลม หรือเมฆ แล้วอ่านช่วงเวลาพยากรณ์จากแผนที่และตาราง Windy</p></header>}
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.layers} role="group" aria-label="ชั้นข้อมูล Windy">{layers.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={layer === id} onClick={() => { if (layer !== id) { setLayer(id); setLoaded(false); } }}><Icon size={17} />{label}</button>)}</div>
        <a href={externalUrl} target="_blank" rel="noopener noreferrer">เปิด Windy เต็มหน้า <ExternalLink size={14} /></a>
      </div>
      <p className={styles.hint} aria-live="polite">{hint}</p>
      <div className={styles.map}>
        {!loaded && <p className={styles.loading} role="status">กำลังเปิด{label}จาก Windy…</p>}
        <iframe key={layer} src={source} title={`Windy · ${label}บริเวณป่าพะยอม`} allow="fullscreen" allowFullScreen onLoad={() => setLoaded(true)} />
      </div>
      <p className={styles.caption}>แผนที่พยากรณ์ ECMWF · ตรวจวัน เวลา และหน่วยจากแถบข้อมูลของ Windy</p>
    </div>
    <section className={styles.forecast} aria-label="ตารางพยากรณ์บริเวณป่าพะยอม">
      <header><div><h2>ตารางพยากรณ์บริเวณป่าพะยอม</h2><p>พิกัดอ้างอิง 7.79°N, 99.93°E · อ่านฝน ลม และช่วงเวลาจากตาราง Windy โดยตรง</p></div><a href="https://www.windy.com/7.790/99.930?7.790,99.930,9" target="_blank" rel="noopener noreferrer">เปิดพยากรณ์ ณ จุดนี้ <ExternalLink size={14} /></a></header>
      <iframe src={forecastSource} title="ตารางพยากรณ์ฝนและลมบริเวณป่าพะยอมจาก Windy" loading="lazy" />
      <p className={styles.caption}>เป็นพยากรณ์ ณ จุดอ้างอิง ไม่ใช่ฝนเฉลี่ยทั้งลุ่มน้ำ · ใช้แบบจำลองตามที่ตาราง Windy แสดง</p>
    </section>
    <footer className={styles.footer}>แหล่งข้อมูล: <a href="https://www.windy.com/" target="_blank" rel="noopener noreferrer">Windy.com</a> · ข้อมูลพยากรณ์เป็นคนละชุดกับเรดาร์ RainViewer และค่าฝนจากสถานี หากแผนที่หรือตารางไม่แสดง ให้เปิด Windy จากลิงก์ด้านบน</footer>
  </section>;
}
