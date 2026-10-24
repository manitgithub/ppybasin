"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CloudRain, Download, ExternalLink, Pause, Play, RefreshCw } from "lucide-react";
import { activeForecastDays, DAILY_FORECAST_SOURCE, forecastColors, FORECAST_REFERENCE, TMD_FORECAST_SOURCE, type BasinForecast } from "@/lib/forecast/basin";
import { waterDate, waterValue } from "@/components/water/WaterChart";
import { waterTime } from "@/lib/water/series";
import type { ForecastBoundary } from "./forecast-render";
import ForecastGallery from "./ForecastGallery";
import styles from "./ForecastMonitor.module.css";
import DailyRainOutlook from "./DailyRainOutlook";

const ForecastMap = dynamic(() => import("./ForecastMap"), { ssr: false, loading: () => <div className={styles.empty} role="status">กำลังเปิดแผนที่ฝนคาดการณ์…</div> });
const modules = [
  ["น้ำไหลเข้าอ่างป่าพะยอม", "1 / 3 / 7 วัน", "รอแบบจำลองฝน–น้ำท่าและการสอบเทียบ"],
  ["ระดับน้ำท้ายอ่าง–บ้านพร้าว", "1–24 ชั่วโมง", "รอแบบจำลองที่รวมการระบายอ่างและระดับน้ำ"],
  ["ภัยแล้งเชิงภูมิอากาศ", "SPI 1–12 เดือน", "รอการคำนวณและตรวจสอบดัชนีคาดการณ์"],
  ["ความเสี่ยงภัยแล้งรายตำบล", "6 เดือน", "ยังไม่มีผลคาดการณ์รายตำบลที่ยืนยันในหน้านี้"],
  ["พื้นที่น้ำท่วมจากดาวเทียม", "เหตุการณ์จริงและย้อนหลัง", "รอชุดพื้นที่น้ำท่วม ไม่ใช่ผลทำนายน้ำท่วมล่วงหน้า"],
];

export default function ForecastMonitor({ onBack }: { onBack?: () => void }) {
  const [data, setData] = useState<BasinForecast | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<"daily" | "basin">("daily");
  const [day, setDay] = useState<string | null>(null), [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1400), [showPoints, setShowPoints] = useState(false);
  const [boundary, setBoundary] = useState<ForecastBoundary | null>(null);
  const [boundaryError, setBoundaryError] = useState(false);
  const request = useRef(0);
  const mapSection = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/boundaries/pa-phayom-forecast.geojson", { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(setBoundary).catch(() => { if (!controller.signal.aborted) setBoundaryError(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController(), id = ++request.current;
    async function load() {
      await Promise.resolve(); if (controller.signal.aborted) return;
      setLoading(true); setPlaying(false); setNow(Date.now());
      try {
        const response = await fetch("/api/basin-forecast", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]), cache: "no-store" });
        const payload: BasinForecast = await response.json();
        if (!response.ok || !payload.checkedAt || !payload.daily && !payload.tmd) throw new Error();
        if (controller.signal.aborted || id !== request.current) return;
        setData(payload); setError("");
        const frames = payload.tmd?.frames ?? [], upcoming = frames.findIndex(frame => waterTime(frame.time) >= Date.now());
        setFrameIndex(upcoming >= 0 ? upcoming : Math.max(0, frames.length - 1));
      } catch { if (!controller.signal.aborted) setError("อ่านข้อมูลคาดการณ์ไม่สำเร็จ กรุณาลองอัปเดตอีกครั้ง"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 600000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [revision]);
  const days = activeForecastDays(data?.daily?.rows ?? [], now);
  const selectedDay = days.find(row => row.date === day) ?? days[0];
  const frames = data?.tmd?.frames ?? [], index = Math.min(frameIndex, Math.max(0, frames.length - 1)), frame = frames[index];
  useEffect(() => {
    if (!playing || view !== "basin" || frames.length < 2) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") setFrameIndex(current => (current + 1) % frames.length); }, speed);
    return () => clearInterval(timer);
  }, [playing, view, frames.length, speed]);
  const allPast = frames.length > 0 && frames.every(frame => waterTime(frame.time) < now);
  function selectFrame(next: number) { setPlaying(false); setFrameIndex(Math.max(0, Math.min(frames.length - 1, next))); }
  function download() {
    if (!data) return;
    const rows = view === "daily" ? [["date", "period_start_utc", "period_end_utc", "rain_mm_per_day", "scope", "issued_at", "received_at"], ...(data.daily?.rows ?? []).map(row => [row.date, new Date(row.start).toISOString(), new Date(row.end).toISOString(), row.rainMm ?? "", "province_93", "", data.daily?.fetchedAt ?? ""])]
      : [["source_time", "mean_mm_hourly_field", "max_grid_mm", "coverage_percent", "missing", "received_at"], ...frames.map(row => [row.time, row.meanMm ?? "", row.maxMm ?? "", row.coverage * 100, row.missing, row.fetchedAt ?? ""])];
    const csv = "\ufeff" + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = `ppy-forecast-${view}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={styles.root} aria-label="คาดการณ์ฝนลุ่มน้ำป่าพะยอม">
    <header className={styles.pageHeader}><div>{onBack && <button className={styles.back} onClick={onBack}><ArrowLeft size={15} />กลับแผนที่</button>}<p className={styles.eyebrow}>ติดตามช่วงถัดไป · ป่าพะยอม–คลองท่าแนะ</p><h1>คาดการณ์</h1><p>อ่านแนวโน้มฝน เลือกพื้นที่และเวลาให้ตรงกับข้อมูลที่ต้องการ</p></div><button className={styles.refresh} disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />{loading ? "กำลังอัปเดต…" : "อัปเดตข้อมูล"}</button></header>
    <div className={styles.sourceTabs} role="group" aria-label="ชุดข้อมูลคาดการณ์">
      <button aria-pressed={view === "daily"} onClick={() => { setView("daily"); setPlaying(false); }}><CalendarDays size={20} /><span><strong>ฝนรายวัน · 7 วัน</strong><small>สสน. · ระดับจังหวัดพัทลุง</small></span></button>
      <button aria-pressed={view === "basin"} onClick={() => setView("basin")}><CloudRain size={20} /><span><strong>ฝนรายชั่วโมงในลุ่มน้ำ</strong><small>TMD · ขอบเขตป่าพะยอม</small></span></button>
    </div>
    {error && <p className={styles.notice} role="alert">{error}{data ? " · แสดงชุดข้อมูลที่รับไว้ก่อนหน้า" : ""}</p>}
    {!data && loading && <div className={styles.empty} role="status">กำลังอ่านพยากรณ์จาก สสน. และชุดข้อมูล TMD…</div>}
    {data && <>
      <div className={styles.received}><span>ตรวจข้อมูล {waterDate(waterTime(data.checkedAt))} น.</span><button onClick={download}><Download size={14} />ดาวน์โหลด CSV</button></div>
      {view === "daily" ? <section className={styles.panel} aria-label="ฝนคาดการณ์รายวัน">
        <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>WRF-ROMS (ThaiGeo) · สสน. / ThaiWater</p><h2>แนวโน้มฝน 7 วัน</h2><p>ค่าระดับจังหวัดพัทลุง · หน่วย มม./วัน</p></div><a href={DAILY_FORECAST_SOURCE} target="_blank" rel="noopener noreferrer">เปิดแหล่งข้อมูล <ExternalLink size={14} /></a></header>
        {data.errors.daily && <p className={styles.notice} role="alert">{data.errors.daily}</p>}
        {!days.length ? <div className={styles.empty}>ยังไม่มีชุดพยากรณ์ที่ครอบคลุมปัจจุบันหรืออนาคต{data.daily?.rows.length ? " · ชุดที่อ่านได้หมดช่วงใช้งานแล้ว" : ""}</div> : <>
          {selectedDay && <DailyRainOutlook days={days} selectedDay={selectedDay} onSelect={setDay} mediaMismatch={data.daily?.mediaMismatch ?? false} />}
        </>}
        <div className={styles.quality}><p>เป็นค่าระดับจังหวัด ต้นทางยังไม่ระบุว่าเป็นค่าเฉลี่ยหรือค่าสูงสุดเชิงพื้นที่ จึงยังใช้แทนฝนรายสถานีหรือค่าเฉลี่ยลุ่มน้ำไม่ได้</p><p>เวลาออกรอบพยากรณ์: ยังไม่ระบุ · เวลารับข้อมูลไม่ใช่เวลาออกพยากรณ์</p></div>

        <details className={styles.details}><summary>ตารางวัน เวลา และค่าจากต้นทาง</summary><div className={styles.tableWrap}><table><thead><tr><th>วันที่คาดการณ์</th><th>ฝน (มม./วัน)</th><th>คำอธิบายต้นทาง</th><th>เวลาไฟล์ภาพใน API</th></tr></thead><tbody>{data.daily?.rows.map(row => <tr key={row.date}><th>{waterDate(row.start, false)}</th><td>{waterValue(row.rainMm)}</td><td>{row.category}</td><td>{row.mediaTime ? waterDate(waterTime(row.mediaTime)) : "ไม่ระบุ"}</td></tr>)}</tbody></table></div></details>
      </section> : <section className={styles.panel} aria-label="ฝนคาดการณ์รายชั่วโมงในลุ่มน้ำ">
        <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>TMD NWP · DOMAIN 2</p><h2>ฝนในลุ่มน้ำตามช่วงเวลา</h2><p>ขอบเขตต้นฉบับป่าพะยอม 3 ส่วน · 457.25 ตร.กม.</p></div><a href={TMD_FORECAST_SOURCE} target="_blank" rel="noopener noreferrer">แหล่งข้อมูล TMD <ExternalLink size={14} /></a></header>
        {data.errors.tmd && <p className={styles.notice} role="alert">{data.errors.tmd}</p>}
        {allPast && <p className={styles.notice}>ชุดที่บันทึกไว้เป็นเวลาที่ผ่านแล้ว แสดงเพื่อทบทวนพยากรณ์เดิม ยังไม่มีช่วงเวลาอนาคตในชุดนี้</p>}
        {!frame ? <div className={styles.empty}>ยังไม่มีผล TMD ที่บันทึกไว้</div> : <>
          <div className={styles.timeControls}><button onClick={() => setPlaying(value => !value)} disabled={frames.length < 2}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "หยุด" : "เล่นตามเวลา"}</button><button onClick={() => selectFrame(index - 1)} disabled={index === 0} aria-label="ช่วงเวลาก่อนหน้า"><ChevronLeft size={20} /></button><button onClick={() => selectFrame(index + 1)} disabled={index === frames.length - 1} aria-label="ช่วงเวลาถัดไป"><ChevronRight size={20} /></button><label>ความเร็ว<select aria-label="ความเร็วภาพพยากรณ์" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={2200}>ช้า</option><option value={1400}>ปกติ</option><option value={800}>เร็ว</option></select></label><label className={styles.frameSelect}>เวลาข้อมูล<select aria-label="เลือกเวลาพยากรณ์ TMD" value={index} onChange={event => selectFrame(Number(event.target.value))}>{frames.map((row, i) => <option key={row.time} value={i}>{waterDate(waterTime(row.time))}{row.missing ? " · ข้อมูลขาด" : ""}</option>)}</select></label></div>
          <label className={styles.scrubber}>เลื่อนช่วงเวลา<input type="range" aria-label="เลื่อนเวลาพยากรณ์ TMD" min={0} max={frames.length - 1} value={index} onChange={event => selectFrame(Number(event.target.value))} /></label>
          <div ref={mapSection} className={styles.mapLayout}><div><div className={styles.mapCaption} aria-live="polite"><strong>{waterDate(waterTime(frame.time))} น.</strong><span>{frame.missing ? "ข้อมูลเวลานี้ขาดหาย" : waterTime(frame.time) < now ? "ช่วงเวลาที่ผ่านแล้ว" : "ช่วงคาดการณ์"}</span></div>{boundary ? <ForecastMap frame={frame} boundary={boundary} showPoints={showPoints} /> : <div className={styles.empty}>{boundaryError ? "โหลดขอบเขตลุ่มน้ำไม่ได้ กรุณาโหลดหน้าใหม่" : "กำลังอ่านขอบเขตลุ่มน้ำ…"}</div>}<div className={styles.legend}><b>มม. / ช่วงข้อมูลรายชั่วโมง</b><div>{forecastColors.map(stop => <span key={stop.from}><i style={{ background: stop.color }} />{stop.label}</span>)}<span><i className={styles.hatch} />ไม่มีข้อมูล</span></div></div><label className={styles.pointToggle}><input type="checkbox" checked={showPoints} onChange={event => setShowPoints(event.target.checked)} />แสดงจุดกริด TMD</label></div>
          <aside className={styles.mapStats}><div><span>ฝนเฉลี่ยลุ่มน้ำโดยประมาณ</span><strong>{waterValue(frame.meanMm)} <small>มม.</small></strong><p>ถ่วงพื้นที่ตัวแทน Thiessen · แสดงเมื่อข้อมูลครบทั้งลุ่มน้ำ</p></div><dl><div><dt>สูงสุดในจุดกริดที่แทนลุ่มน้ำ</dt><dd>{waterValue(frame.maxMm)} มม.</dd></div><div><dt>พื้นที่ตัวแทนมีค่าฝน</dt><dd>{waterValue(frame.coverage * 100)}%</dd></div><div><dt>เวลาที่มีผล / ทั้งชุด</dt><dd>{frames.filter(row => !row.missing).length} / {frames.length}</dd></div></dl><p>รับข้อมูลเวลานี้ {frame.fetchedAt ? waterDate(waterTime(frame.fetchedAt)) : "ไม่ระบุ"}</p><p>เวลาออกรอบ: {data.tmd?.issuedAt ? waterDate(waterTime(data.tmd.issuedAt)) : "ยังไม่ยืนยัน"}</p></aside></div>
        </>}
        {boundary && frames.length > 0 && <ForecastGallery frames={frames} boundary={boundary} selectedIndex={index} onSelect={next => {
          selectFrame(next);
          mapSection.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
        }} />}
        <div className={styles.quality}><p>แต่ละภาพแสดงฝนของช่วงรายชั่วโมง ไม่รวมเป็นฝนสะสม 3, 6 หรือ 24 ชั่วโมง ช่องว่างคงเป็นไม่มีข้อมูล</p><p>แผนที่ประมาณระหว่างจุดกริดแบบ bilinear และตัดตามขอบเขตลุ่มน้ำ สีที่เรียบขึ้นไม่ได้เพิ่มความละเอียดของแบบจำลอง</p><p>ใช้ผล TMD ที่บันทึกจากเว็บอ้างอิง ยังไม่ยืนยันว่าแต่ละภาพมาจากรอบแบบจำลองเดียวกัน และไม่ใช้เปลี่ยนสถานะเตือนภัยอัตโนมัติ</p><a href={`${FORECAST_REFERENCE}/#forecast`} target="_blank" rel="noopener noreferrer">ดูชุดข้อมูลที่บันทึกและวิธีคำนวณ <ExternalLink size={13} /></a></div>
      </section>}
      <section className={styles.modules}><header><h2>การคาดการณ์อื่น</h2><p>แสดงสถานะความพร้อมแยกจากข้อมูลฝนที่เชื่อมแล้ว</p></header>{modules.map(([name, horizon, detail]) => <article key={name}><div><h3>{name}</h3><p>{horizon} · {detail}</p></div><span>ยังไม่พร้อมคาดการณ์</span></article>)}</section>
      <a className={styles.next} href="https://www.tmd.go.th/forecast/sevenday" target="_blank" rel="noopener noreferrer">เทียบพยากรณ์ 7 วันจากกรมอุตุนิยมวิทยา <ArrowRight size={15} /></a>
    </>}
  </section>;
}
