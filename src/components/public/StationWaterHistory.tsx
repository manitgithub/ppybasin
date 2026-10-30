"use client";

import { useEffect, useId, useState } from "react";
import { observationLabel } from "@/lib/public-situation";
import styles from "./StationWaterHistory.module.css";

type WaterPoint = { recorded_at: string; water_level: number };

export default function StationWaterHistory({ deviceId }: { deviceId: string }) {
  const titleId = useId();
  const [readings, setReadings] = useState<WaterPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/sensor/history?device_id=${encodeURIComponent(deviceId)}`, {
      cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    }).then(async response => {
      const payload = await response.json();
      if (!response.ok || !payload.ok || !Array.isArray(payload.readings)) throw new Error("History unavailable");
      const points: WaterPoint[] = payload.readings;
      if (points.some(point => typeof point.water_level !== "number" || !Number.isFinite(point.water_level) || !Number.isFinite(Date.parse(point.recorded_at)))) throw new Error("Invalid history");
      if (!controller.signal.aborted) { setReadings(points); setStatus("ready"); }
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [deviceId, retry]);

  const currentIndex = Math.min(selected ?? readings.length - 1, readings.length - 1);
  const current = readings[currentIndex];
  const first = readings[0], last = readings.at(-1);
  const values = readings.map(point => point.water_level);
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * .15, .05);
  const low = minimum - padding, high = maximum + padding;
  const width = 340, height = 144, left = 42, right = 8, top = 12, bottom = 20;
  const start = first ? Date.parse(first.recorded_at) : 0;
  const duration = last ? Date.parse(last.recorded_at) - start : 0;
  const x = (point: WaterPoint) => duration ? left + (Date.parse(point.recorded_at) - start) / duration * (width - left - right) : (left + width - right) / 2;
  const y = (value: number) => top + (high - value) / (high - low) * (height - top - bottom);
  const path = readings.map((point, index) => `${index ? "L" : "M"}${x(point).toFixed(2)},${y(point.water_level).toFixed(2)}`).join(" ");
  const format = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const axisTime = (value: string) => new Date(value).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

  return <section className={styles.history} aria-labelledby={titleId}>
    <div className={styles.heading}><h3 id={titleId}>ระดับน้ำย้อนหลัง</h3><span>{status === "ready" ? `${readings.length} ข้อมูลล่าสุด` : "50 ข้อมูลล่าสุด"}</span></div>
    {status === "loading" && <p className={styles.message} role="status">กำลังโหลดกราฟ…</p>}
    {status === "error" && <div className={styles.message} role="status">โหลดกราฟไม่สำเร็จ <button type="button" onClick={() => { setStatus("loading"); setRetry(value => value + 1); }}>ลองใหม่</button></div>}
    {status === "ready" && !readings.length && <p className={styles.message}>ยังไม่มีข้อมูลระดับน้ำย้อนหลัง</p>}
    {status === "ready" && current && first && last && <>
      <div className={styles.selection} aria-live="polite"><strong>{format(current.water_level)} <small>ม.</small></strong><span>{observationLabel(current.recorded_at)}</span></div>
      <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`ระดับน้ำ ${readings.length} ข้อมูล จาก ${observationLabel(first.recorded_at)} ถึง ${observationLabel(last.recorded_at)} ต่ำสุด ${format(minimum)} สูงสุด ${format(maximum)} เมตร`}>
        {[high, (high + low) / 2, low].map((value, index) => <g key={index}>
          <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className={styles.grid} />
          <text x={left - 6} y={y(value) + 3} textAnchor="end">{value.toFixed(2)}</text>
        </g>)}
        <path d={path} className={styles.line} />
        <line x1={x(current)} x2={x(current)} y1={top} y2={height - bottom} className={styles.cursor} />
        <circle cx={x(current)} cy={y(current.water_level)} r="4" className={styles.point} />
        <text x={left} y={height - 3}>{axisTime(first.recorded_at)}</text>
        <text x={width - right} y={height - 3} textAnchor="end">{axisTime(last.recorded_at)}</text>
      </svg>
      {readings.length > 1 && <input className={styles.scrubber} type="range" min={0} max={readings.length - 1} value={currentIndex}
        aria-label="เลือกข้อมูลระดับน้ำย้อนหลัง" aria-valuetext={`${format(current.water_level)} เมตร ${observationLabel(current.recorded_at)}`}
        onChange={event => setSelected(Number(event.target.value))} />}
    </>}
  </section>;
}
