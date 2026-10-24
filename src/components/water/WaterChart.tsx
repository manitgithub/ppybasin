"use client";

import { useEffect, useRef, useState } from "react";
import type { WaterPoint } from "@/lib/water/series";
import { smoothWaterPath } from "@/lib/water/chart-path";
import styles from "./WaterMonitor.module.css";

export function waterDate(t: number, hourly = true) {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", ...(hourly ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(t);
}
export function waterValue(value: number | null | undefined) { return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: 2 }); }

export default function WaterChart({ points, unit, hourly, thresholds }: {
  points: WaterPoint[]; unit: string; hourly: boolean; thresholds: { label: string; value: number }[];
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(820);
  const [inspected, setInspected] = useState<number | null>(null);
  const valid = points.filter(point => point.value !== null);
  const hasValues = valid.length > 0;
  useEffect(() => {
    if (!svg.current) return;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setChartWidth(entry.contentRect.width); });
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, [hasValues]);
  if (!valid.length) return <div className={styles.chartEmpty}><strong>ไม่มีค่าที่ตรงกับช่วงเวลานี้</strong><p>ลองเลือกช่วงเวลาหรือสถานีอื่น ช่องว่างจะไม่ถูกแทนด้วยศูนย์</p>{!hourly && <p>สถิติรายวันแสดงเฉพาะวันที่จบแล้วและมีข้อมูลอย่างน้อย 90% ส่วนค่า 06:00 น. ต้องมีการตรวจวัดตรงเวลา</p>}</div>;
  const values = [...valid.map(point => point.value!), ...thresholds.map(threshold => threshold.value)];
  const low = Math.min(...values), high = Math.max(...values), pad = Math.max((high - low) * .13, .05);
  const height = chartWidth >= 700 ? 220 : 260;
  const min = low - pad, max = high + pad, left = 64, right = chartWidth - 34, top = 26, bottom = height - 40;
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * (right - left);
  const y = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const path = smoothWaterPath(points.map((point, i) => ({ x: x(i), y: point.value === null ? null : y(point.value) })));
  const index = Math.min(points.length - 1, inspected ?? points.length - 1), selected = points[index];
  return <div className={styles.chart}>
    <div className={styles.inspection} aria-live="polite"><span>{waterDate(selected.t, hourly)}</span><strong>{waterValue(selected.value)} <small>{selected.value !== null ? unit : "ไม่มีข้อมูล"}</small></strong>{selected.observedAt && <span>ตรวจวัด {waterDate(selected.observedAt)}</span>}</div>
    <svg ref={svg} viewBox={`0 0 ${chartWidth} ${height}`} role="img" aria-label={`กราฟ${unit === "ลบ.ม./วินาที" ? "อัตราการไหล" : "ระดับน้ำ"} ${hourly ? "รายชั่วโมง" : "รายวัน"} มีข้อมูล ${valid.length} จาก ${points.length} จุด`}
      onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setInspected(Math.max(0, Math.min(points.length - 1, Math.round(((event.clientX - rect.left) / rect.width * chartWidth - left) / (right - left) * (points.length - 1))))); }}>
      <text x={left} y="13" className={styles.axis}>{unit}</text>
      {Array.from({ length: 5 }, (_, i) => { const value = min + i / 4 * (max - min); return <g key={i}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className={styles.gridLine} /><text x={left - 10} y={y(value) + 4} textAnchor="end" className={styles.axis}>{waterValue(value)}</text></g>; })}
      {thresholds.map(threshold => <g key={threshold.label}><line x1={left} x2={right} y1={y(threshold.value)} y2={y(threshold.value)} stroke="#9b6830" strokeDasharray="7 5" /><text x={right} y={y(threshold.value) - 5} textAnchor="end" className={styles.axis}>{threshold.label} {waterValue(threshold.value)}</text></g>)}
      <path d={path} fill="none" stroke="#087e96" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, i) => point.value !== null && <circle key={point.t} cx={x(i)} cy={y(point.value)} r={points.length > 72 ? 2 : 3} fill="#087e96"><title>{waterDate(point.t, hourly)} · {waterValue(point.value)} {unit}</title></circle>)}
      <line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="#6b92a7" strokeDasharray="3 4" />
      {selected.value !== null && <circle cx={x(index)} cy={y(selected.value)} r="5" fill="#f8fbfc" stroke="#087e96" strokeWidth="2" />}
      {[...new Set(Array.from({ length: 5 }, (_, i) => Math.round(i * (points.length - 1) / 4)))].map((i, tick) => <text key={i} x={x(i)} y={height - 14} textAnchor={tick === 0 ? "start" : tick === 4 ? "end" : "middle"} className={`${styles.axis} ${tick === 1 || tick === 3 ? styles.sparseTick : ""}`}>{hourly ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(points[i].t) : waterDate(points[i].t, false)}</text>)}
    </svg>
    <label className={styles.chartScrubber}>เลื่อนดูค่าตามเวลา<input aria-label="ตรวจค่าตามเวลาในกราฟ" type="range" min="0" max={points.length - 1} value={index} onChange={event => setInspected(Number(event.target.value))} /></label>
    <p className={styles.chartLegend}><span />{hourly ? "ค่าตรวจวัดสุดท้ายในแต่ละชั่วโมง" : "ค่ารายวันตามวิธีที่เลือก"} · ช่องว่างคือช่วงที่ไม่มีข้อมูล</p>
  </div>;
}
