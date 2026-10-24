"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Download } from "lucide-react";
import { forecastColors, type TmdFrame } from "@/lib/forecast/basin";
import { waterTime } from "@/lib/water/series";
import { waterDate, waterValue } from "@/components/water/WaterChart";
import { renderForecastSnapshot, type ForecastBoundary } from "./forecast-render";
import styles from "./ForecastGallery.module.css";

export default function ForecastGallery({ frames, boundary, selectedIndex, onSelect }: {
  frames: TmdFrame[]; boundary: ForecastBoundary; selectedIndex: number; onSelect: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return <details className={styles.gallery} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary><span>ภาพนิ่งเทียบหลายเวลา · สเกลสีเดียวกัน <small>{frames.length} ช่วงเวลา</small></span><ChevronDown size={18} /></summary>
    {expanded && <div className={styles.content}>
      <p className={styles.description}>เปรียบเทียบฝนในขอบเขตเดียวกันทุกภาพ · แต่ละภาพเป็นข้อมูลของช่วงรายชั่วโมงนั้น เวลาที่ขาดแสดงแรเงาและไม่แทนด้วยศูนย์</p>
      <div className={styles.legend} aria-label="สเกลสีร่วมทุกช่วงเวลา"><strong>มม. / ช่วงรายชั่วโมง</strong><div>{forecastColors.map(stop => <span key={stop.from}><i style={{ background: stop.color }} />{stop.label}</span>)}<span><i className={styles.hatch} />ไม่มีข้อมูล</span></div></div>
      <div className={styles.frames}>{frames.map((frame, index) => <Snapshot key={frame.time} frame={frame} boundary={boundary} selected={index === selectedIndex} onSelect={() => onSelect(index)} />)}</div>
      <p className={styles.note}>ค่าเฉลี่ยถ่วงพื้นที่ตัวแทนจากจุดกริด TMD · ค่าสูงสุดเฉพาะจุดกริดที่แทนพื้นที่ลุ่มน้ำ · ช่วงสีคงที่และตรงกับแผนที่หลัก ไม่ปรับสเกลแยกรายภาพ</p>
    </div>}
  </details>;
}

function Snapshot({ frame, boundary, selected, onSelect }: { frame: TmdFrame; boundary: ForecastBoundary; selected: boolean; onSelect: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rendered = useRef<{ frame: TmdFrame; boundary: ForecastBoundary } | null>(null);
  const draw = useCallback(() => {
    if (!canvas.current || rendered.current?.frame === frame && rendered.current.boundary === boundary) return;
    const image = renderForecastSnapshot(frame, boundary, new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(waterTime(frame.time)));
    if (!image) return;
    const target = canvas.current; target.width = image.width; target.height = image.height;
    const context = target.getContext("2d"); if (!context) return;
    context.drawImage(image, 0, 0); rendered.current = { frame, boundary };
  }, [frame, boundary]);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { draw(); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [draw]);
  function download() {
    draw(); if (!canvas.current || rendered.current?.frame !== frame || rendered.current.boundary !== boundary) return;
    const link = document.createElement("a"); link.href = canvas.current.toDataURL("image/png");
    link.download = `ppy-tmd-${frame.time.replace(/[^0-9T-]/g, "-")}.png`; link.click();
  }
  return <article className={styles.frame} data-selected={selected} data-missing={frame.missing} aria-label={`ภาพนิ่ง ${waterDate(waterTime(frame.time))}`}>
    <header><time dateTime={frame.time}>{waterDate(waterTime(frame.time))} น.</time><span>{frame.missing ? "ข้อมูลขาด" : selected ? "แสดงบนแผนที่" : "รายชั่วโมง"}</span></header>
    <canvas ref={canvas} role="img" aria-label={`ภาพฝน TMD ${waterDate(waterTime(frame.time))}${frame.missing ? " ไม่มีข้อมูล แสดงแรเงา" : ` ฝนเฉลี่ย ${waterValue(frame.meanMm)} มม. สูงสุด ${waterValue(frame.maxMm)} มม.`} สเกลสีเดียวกับแผนที่หลัก`} />
    <dl><div><dt>เฉลี่ยลุ่มน้ำ</dt><dd>{waterValue(frame.meanMm)} <small>มม.</small></dd></div><div><dt>สูงสุดในกริดลุ่มน้ำ</dt><dd>{waterValue(frame.maxMm)} <small>มม.</small></dd></div><div><dt>พื้นที่มีข้อมูล</dt><dd>{waterValue(frame.coverage * 100)}%</dd></div></dl>
    <footer><button type="button" onClick={onSelect} aria-label={`ดูบนแผนที่ ${waterDate(waterTime(frame.time))}`}><ArrowUpRight size={15} />ดูบนแผนที่</button><button type="button" onClick={download} aria-label={`ดาวน์โหลด PNG ${waterDate(waterTime(frame.time))}`}><Download size={15} />PNG</button></footer>
  </article>;
}
