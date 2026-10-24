"use client";

/* eslint-disable @next/next/no-img-element -- Preserve the full original forecast image, including its dates and legend. */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CloudRain, ExternalLink, RefreshCw } from "lucide-react";
import { DAILY_FORECAST_SOURCE, FORECAST_REFERENCE, type DailyRainForecast } from "@/lib/forecast/basin";
import { waterDate, waterValue } from "@/components/water/WaterChart";
import styles from "./DailyRainOutlook.module.css";

function tone(row: DailyRainForecast) {
  if (row.rainMm === null) return "missing";
  if (row.category.includes("หนักมาก")) return "very-heavy";
  if (row.category.includes("หนัก")) return "heavy";
  if (row.category.includes("ปานกลาง")) return "moderate";
  return "normal";
}
function summary(row: DailyRainForecast) {
  if (row.rainMm === null) return "ยังไม่มีค่าฝนคาดการณ์";
  return row.category && row.category !== "ไม่ระบุ" ? `คาดการณ์${row.category}` : "ปริมาณฝนคาดการณ์";
}
export default function DailyRainOutlook({ days, selectedDay, onSelect, mediaMismatch }: {
  days: DailyRainForecast[]; selectedDay: DailyRainForecast; onSelect: (date: string) => void; mediaMismatch: boolean;
}) {
  const dayStrip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = dayStrip.current, selected = strip?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!strip || !selected || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: strip.scrollLeft + selected.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - selected.clientWidth) / 2, behavior: "instant" });
  }, [selectedDay.date]);
  const highlighted = days.filter(row => tone(row) === "heavy" || tone(row) === "very-heavy").sort((a, b) => (b.rainMm ?? 0) - (a.rainMm ?? 0))[0];
  return <>
    {highlighted && <div className={styles.weekSignal}><CloudRain size={22} aria-hidden="true" /><div><strong>{waterDate(highlighted.start, false)} · {summary(highlighted)}</strong><p>สสน. คาดฝนระดับจังหวัด {waterValue(highlighted.rainMm)} มม./วัน · ติดตามฝนจริงและประกาศในพื้นที่</p></div><button type="button" onClick={() => onSelect(highlighted.date)}>ดูวันนี้ <ArrowRight size={15} /></button></div>}
    <div ref={dayStrip} className={styles.days} aria-label="เลือกวันคาดการณ์">{days.map(row => <button key={row.date} type="button" aria-pressed={row.date === selectedDay.date} data-tone={tone(row)} onClick={() => onSelect(row.date)}>
      <span>{waterDate(row.start, false)}</span><strong>{waterValue(row.rainMm)} <small>มม.</small></strong><small>{row.rainMm === null ? "ไม่มีค่าพยากรณ์" : row.category}</small>
    </button>)}</div>
    <div className={styles.outlook}>
      <ForecastImage key={selectedDay.date} row={selectedDay} mediaMismatch={mediaMismatch} />
      <aside className={styles.interpretation} data-tone={tone(selectedDay)} aria-label="สรุปฝนวันที่เลือก" aria-live="polite">
        <p className={styles.eyebrow}>{waterDate(selectedDay.start, false)} · จังหวัดพัทลุง</p>
        <h3>{summary(selectedDay)}</h3>
        <p className={styles.reading}><strong>{waterValue(selectedDay.rainMm)}</strong><span>มม./วัน</span></p>
        <p className={styles.category}>การจัดกลุ่มจากต้นทาง: <b>{selectedDay.rainMm === null ? "ไม่มีค่าพยากรณ์" : selectedDay.category}</b></p>
        <div className={styles.period}><span>ช่วงสะสมฝน · เวลาประเทศไทย</span><strong>{waterDate(selectedDay.start, false)} 07:00 น.<br />ถึง {waterDate(selectedDay.end, false)} 07:00 น.</strong></div>
        <p className={styles.explanation}>{tone(selectedDay) === "very-heavy" || tone(selectedDay) === "heavy" ? "ควรติดตามฝนจริงในพื้นที่และประกาศจากหน่วยงาน โดยเฉพาะเมื่อฝนตกต่อเนื่อง" : selectedDay.rainMm === null ? "ยังแปลผลปริมาณฝนของวันนี้ไม่ได้ โปรดตรวจข้อมูลจากต้นทางอีกครั้ง" : "ใช้ดูแนวโน้มฝนของวันที่เลือก ประกอบกับฝนตรวจวัดจริงในพื้นที่"}</p>
        <p className={styles.scope}>ค่าระดับจังหวัด ไม่ใช่ค่าฝนเฉพาะป่าพะยอมหรือผลคาดการณ์น้ำท่วม</p>
        <a href={DAILY_FORECAST_SOURCE} target="_blank" rel="noopener noreferrer">ตรวจพยากรณ์จาก สสน. <ExternalLink size={14} /></a>
      </aside>
    </div>
  </>;
}

function ForecastImage({ row, mediaMismatch }: { row: DailyRainForecast; mediaMismatch: boolean }) {
  const [failed, setFailed] = useState(false), [loaded, setLoaded] = useState(false), [retry, setRetry] = useState(0);
  const source = `${FORECAST_REFERENCE}/api/rain-forecast-image?date=${row.date}${retry ? `&retry=${retry}` : ""}`;
  return <figure className={styles.figure}>
    <header><strong>ภาพพยากรณ์ต้นฉบับ · สสน.</strong><a href={source} target="_blank" rel="noopener noreferrer">ขยายภาพ <ExternalLink size={14} /></a></header>
    <div className={styles.image}>
      {failed ? <div className={styles.imageFallback}><CloudRain size={28} /><strong>ยังเปิดภาพพยากรณ์ไม่ได้</strong><p>ตัวเลขด้านข้างเป็นค่าจาก API ของ สสน.</p><button type="button" onClick={() => { setFailed(false); setLoaded(false); setRetry(value => value + 1); }}><RefreshCw size={15} />ลองโหลดภาพอีกครั้ง</button><a href={DAILY_FORECAST_SOURCE} target="_blank" rel="noopener noreferrer">เปิดเว็บไซต์ สสน. <ExternalLink size={14} /></a></div>
        : <><a href={source} target="_blank" rel="noopener noreferrer"><img key={source} src={source} alt={`ภาพพยากรณ์ฝนจังหวัดพัทลุงที่ต้นทางผูกกับวันที่ ${waterDate(row.start, false)} ตรวจวันและช่วงสะสมบนหัวภาพ`} onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }} /></a>{!loaded && <p className={styles.imageLoading} role="status">กำลังอ่านภาพพยากรณ์จาก สสน.…</p>}</>}
    </div>
    <figcaption>{mediaMismatch ? <strong>เวลาไฟล์ภาพใน API ไม่ตรงกับช่วงพยากรณ์ โปรดเทียบวันที่บนหัวภาพกับวันที่เลือกก่อนอ่านภาพร่วมกับตัวเลข</strong> : "ตรวจวันที่ ช่วงสะสม และคำอธิบายสีบนภาพก่อนอ่านผล · กดภาพเพื่อขยาย"}</figcaption>
  </figure>;
}
