"use client";

import { DataSources } from "@/components/DataSource";
import { observationLabel } from "@/lib/public-situation";
import { RAIN_COLORS, type RainMethod, type RainSurfaceStatus } from "@/lib/rain-interpolation";
import type { SourceHealth } from "@/lib/situation/adapters";
import styles from "./PublicMapHome.module.css";

export default function RainSurfaceControls({ method, opacity, onMethod, onOpacity, status, sources }: {
  method: RainMethod; opacity: number; onMethod: (method: RainMethod) => void; onOpacity: (opacity: number) => void;
  status: RainSurfaceStatus | null; sources: SourceHealth[];
}) {
  return <div className={styles.surfaceControls}>
    <label>วิธีประมาณค่า
      <select aria-label="วิธีประมาณค่าฝน" value={method} onChange={event => onMethod(event.target.value as RainMethod)}>
        <option value="tps">Thin-plate spline</option><option value="idw">IDW · ระยะทางกำลังสอง</option>
      </select>
    </label>
    <label>ความทึบ <span>{Math.round(opacity * 100)}%</span>
      <input aria-label="ความทึบของชั้นประมาณฝน" type="range" min="0.15" max="0.9" step="0.05" value={opacity} onChange={event => onOpacity(Number(event.target.value))} />
    </label>
    <div className={styles.surfaceStatus} role="status" aria-live="polite">
      {status?.state === "ready" ? <>
        <strong>ใช้ {status.used}/{status.total} สถานี · ครอบคลุม {Math.round(status.coverage * 100)}%</strong>
        <p>{status.from !== null && status.to !== null && <>ปลายช่วงสะสม {observationLabel(new Date(status.from).toISOString())}{status.from !== status.to && <> – {observationLabel(new Date(status.to).toISOString())}</>}</>}</p>
      </> : <p>{!status ? "กำลังตรวจข้อมูลสถานี…" : status.state === "boundary" ? "เลือกขอบเขตลุ่มน้ำเพื่อแสดงพื้นสี · หากเลือกแล้วให้รอโหลดขอบเขต" : status.state === "insufficient" ? `มีสถานีที่ใช้ได้ ${status.used}/${status.total} แห่ง · ต้องมีอย่างน้อย 3 จุดที่ไม่อยู่ในแนวเดียวกัน` : "คำนวณพื้นสีไม่ได้ ลองเปลี่ยนวิธีหรืออัปเดตข้อมูลฝน"}</p>}
    </div>
    <div className={styles.surfaceLegend} aria-label="ปริมาณฝน มิลลิเมตรต่อ 24 ชั่วโมง">
      <strong>มม./24 ชม.</strong>
      <div>{RAIN_COLORS.map(([value, color]) => <span key={value}><i style={{ backgroundColor: color }} />{value === 150 ? "150+" : value}</span>)}</div>
      <p><i className={styles.surfaceHatch} /> ไม่มีข้อมูลรองรับ</p>
    </div>
    <p>พื้นสีเป็นค่าประมาณฝนระหว่างสถานี</p>
    <details className={styles.surfaceNotes}><summary>ข้อมูลที่ใช้และข้อจำกัด</summary>
      <p>ใช้ฝนสะสม 24 ชั่วโมง อายุไม่เกิน 2 ชั่วโมง และปลายช่วงสะสมต่างกันไม่เกิน 60 นาที ไม่เติมข้อมูลที่หายด้วยศูนย์</p>
      <p>แสดงสีในลุ่มน้ำที่เลือก เฉพาะภายในกรอบครอบสถานีและห่างจากสถานีไม่เกิน 15 กม. พื้นที่แรเงาไม่มีข้อมูลรองรับ</p>
      <p>Thin-plate spline ปรับความเรียบและจำกัดผลระหว่างศูนย์กับฝนสูงสุดในชุดข้อมูล ส่วน IDW ใช้น้ำหนักตามระยะทางกำลังสอง</p>
      <DataSources sources={sources} />
    </details>
  </div>;
}
