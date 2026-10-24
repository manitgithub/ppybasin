"use client";

import { ChevronDown, MapPin, Search } from "lucide-react";
import { useId, useState } from "react";
import { filterCatalog, stationCategories, stationMetric, type CatalogStation, type StationCategory } from "@/lib/station-catalog";
import { isRecentObservation, observationLabel } from "@/lib/public-situation";
import styles from "./StationCatalogPanel.module.css";

export default function StationCatalogPanel({ stations, category, onCategory, onSelect, focusedCode, now }: {
  stations: CatalogStation[]; category: StationCategory; onCategory: (category: StationCategory) => void;
  onSelect: (station: CatalogStation) => void; focusedCode?: string; now: number;
}) {
  const [query, setQuery] = useState("");
  const id = useId();
  const visible = filterCatalog(stations, category, query);
  return <details className={styles.panel} data-station-catalog open>
    <summary><span><MapPin size={17} />เลือกสถานีบนแผนที่</span><ChevronDown size={15} /></summary>
    <div className={styles.content}>
      <label className={styles.search}><Search size={15} /><input aria-label="ค้นหาสถานี" placeholder="รหัส ชื่อ หรือหน่วยงาน" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className={styles.tabs} role="tablist" aria-label="หมวดสถานี">
        {stationCategories.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`${id}-${tab.id}`} aria-selected={category === tab.id} aria-controls={`${id}-list`} tabIndex={category === tab.id ? 0 : -1}
          onClick={() => onCategory(tab.id)} onKeyDown={event => {
            const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : null;
            if (next === null) return;
            event.preventDefault(); onCategory(stationCategories[next].id);
            document.getElementById(`${id}-${stationCategories[next].id}`)?.focus();
          }}>{tab.label}<small>{filterCatalog(stations, tab.id).length}</small></button>)}
      </div>
      <p className={styles.count}>{visible.length} จาก {stations.length} สถานี · กดเพื่อดูบนแผนที่</p>
      <div className={styles.list} role="tabpanel" id={`${id}-list`} aria-labelledby={`${id}-${category}`}>
        {visible.map(station => {
          const metric = stationMetric(station, category), available = metric.value !== null && Number.isFinite(metric.value);
          return <button type="button" key={station.code} className={styles.station} aria-pressed={focusedCode === station.code} onClick={event => {
            onSelect(station);
            if (window.matchMedia("(max-width: 600px)").matches) event.currentTarget.closest("details")?.removeAttribute("open");
          }}>
            <span><strong>{station.name}</strong><small>{station.code} · {station.agency}</small></span>
            <span className={styles.metric}><small>{metric.label}</small><b>{available ? metric.value!.toLocaleString("th-TH", { maximumFractionDigits: category === "flow" ? 2 : 1 }) : "—"}</b>{available ? <small>{metric.unit}</small> : <small>ยังไม่มีข้อมูล</small>}</span>
            {metric.observedAt && <time>{observationLabel(metric.observedAt)}{!isRecentObservation(metric.observedAt, now) && " · ข้อมูลเก่าหรือเวลาไม่พร้อม"}</time>}
          </button>;
        })}
        {!visible.length && <p className={styles.empty}>ไม่พบสถานีที่ตรงกับคำค้น</p>}
      </div>
    </div>
  </details>;
}
