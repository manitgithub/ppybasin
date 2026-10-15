"use client";

import { Pause, Play } from "lucide-react";
import { radarFrameLabel } from "@/lib/rainviewer";
import type useRainViewer from "./useRainViewer";
import styles from "./PublicMapHome.module.css";

export default function RainViewerControls({ radar, now }: { radar: ReturnType<typeof useRainViewer>; now: number }) {
  const stale = radar.data && now / 1000 - radar.data.frames.at(-1)!.time > 30 * 60;
  return <div className={styles.radarControls} aria-label="ควบคุมเรดาร์ RainViewer">
    <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">Weather data by RainViewer</a>
    {!radar.data && !radar.error && <p role="status">กำลังโหลดภาพเรดาร์…</p>}
    {radar.error && <p role="status">โหลดข้อมูลเรดาร์ไม่ได้{radar.data ? " · แสดงภาพที่โหลดไว้" : ""} <button type="button" onClick={radar.retry}>ลองอีกครั้ง</button></p>}
    {radar.data && radar.frame && <>
      <p>เวลาภาพ <time dateTime={new Date(radar.frame.time * 1000).toISOString()}>{radarFrameLabel(radar.frame.time)}</time></p>
      <div className={styles.radarAnalysis} aria-label="วิเคราะห์พื้นที่ฝน">
        {radar.area.playing ? <p>หยุดภาพเพื่อวิเคราะห์พื้นที่ฝนตามเวลาที่เลือก</p>
          : radar.area.failed ? <p>ยังประเมินพื้นที่ฝนไม่ได้ · ไม่ถือว่าไม่มีฝน <button type="button" onClick={radar.retry}>ลองประเมินอีกครั้ง</button></p>
          : !radar.area.result ? <p>กำลังประเมินพื้นที่ฝน…</p>
          : radar.area.result.rainPercent === null ? <p>ไม่พบพื้นที่ในขอบเขตครอบคลุมเรดาร์ จึงยังประเมินฝนไม่ได้</p>
          : <>
            <p><strong>กลุ่มฝนปกคลุมประมาณ {radar.area.result.rainPercent > 0 && radar.area.result.rainPercent < 1 ? "น้อยกว่า 1" : Math.round(radar.area.result.rainPercent)} %</strong><br />{radar.area.result.coveragePercent > 99.99 ? "ของพื้นที่ลุ่มน้ำป่าพะยอม" : "ของพื้นที่ที่เรดาร์ครอบคลุมในลุ่มน้ำป่าพะยอม"}</p>
            <small>เรดาร์ครอบคลุม {radar.area.result.coveragePercent.toLocaleString("th-TH", { maximumFractionDigits: 1 })} % ของลุ่มน้ำ · ค่าประเมินจากภาพ</small>
          </>}
      </div>
      {stale && <p className={styles.radarWarning}>ภาพล่าสุดเกิน 30 นาที</p>}
      {radar.tileError && <p className={styles.radarWarning} role="status">ภาพบางส่วนโหลดไม่ได้ <button type="button" onClick={radar.retry}>ลองอีกครั้ง</button></p>}
      <details><summary>เล่นย้อนหลัง / ปรับความทึบ</summary>
      <div className={styles.radarPlayback}>
        <button type="button" disabled={radar.data.frames.length < 2 || radar.error} aria-label={radar.playing ? "หยุดภาพเรดาร์" : "เล่นภาพเรดาร์ย้อนหลัง"} onClick={() => radar.setPlaying(!radar.playing)}>{radar.playing ? <Pause size={15} /> : <Play size={15} />}{radar.playing ? "หยุด" : "เล่นย้อนหลัง"}</button>
        <button type="button" onClick={radar.latest}>ภาพล่าสุด</button>
      </div>
      <input type="range" min={0} max={radar.data.frames.length - 1} value={radar.index} aria-label="เวลาภาพเรดาร์" aria-valuetext={radarFrameLabel(radar.frame.time)} onChange={(event) => radar.selectFrame(Number(event.target.value))} />
      <label className={styles.radarOpacity}>ความทึบ {Math.round(radar.opacity * 100)} %<input type="range" min={10} max={100} step={10} value={Math.round(radar.opacity * 100)} aria-label="ความทึบภาพเรดาร์" onChange={(event) => radar.setOpacity(Number(event.target.value) / 100)} /></label>
      </details>
    </>}
    <details><summary>เกี่ยวกับภาพเรดาร์</summary><p>ภาพย้อนหลังประมาณ 2 ชั่วโมง ไม่ใช่ค่าฝนสะสมหรือพยากรณ์ล่วงหน้า ภาพขยายอาจหยาบ พื้นที่ไม่มีสีอาจไม่มีข้อมูล ไม่ได้ยืนยันว่าไม่มีฝน เวลาภาพเป็นเวลารวมภาพจากเรดาร์หลายแห่ง</p><p>สัดส่วนพื้นที่ฝนคำนวณภายในขอบเขตลุ่มน้ำป่าพะยอมจากภาพไม่ปรับความนุ่ม เกณฑ์สัญญาณตั้งแต่ 15 dBZ โดยไม่นับพื้นที่นอกขอบเขตเรดาร์ในตัวหาร เป็นการประมาณจากพิกเซล ไม่ใช่โอกาสฝนตกหรือค่าตรวจวัดภาคพื้นดิน แผนที่ขอบเขตเรดาร์อาจไม่สะท้อนการขัดข้องล่าสุด</p></details>
  </div>;
}
