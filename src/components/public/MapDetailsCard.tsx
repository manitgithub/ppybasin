import { Clock3, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { shouldShowDataSource, type DataSourceInfo } from "@/components/DataSource";
import { isRecentObservation, observationLabel, observationTime } from "@/lib/public-situation";
import styles from "./MapDetailsCard.module.css";

export const mapDetailsPopupOptions = {
  className: `smart-map-popup ${styles.popup}`,
  maxWidth: 400, minWidth: 260,
  autoPanPaddingTopLeft: [16, 16] as [number, number],
  autoPanPaddingBottomRight: [16, 90] as [number, number],
};
export type MapDetailMetric = {
  label: string; value: number | string | null | undefined; unit?: string; observedAt?: string | null;
};
export function mapCoordinates(lat: number, lng: number) { return `${lat.toFixed(6)}, ${lng.toFixed(6)}`; }

export default function MapDetailsCard({ code, title, area, tags, metrics, metadata, sources = [], note, now, children }: {
  code?: string | null; title: string; area?: string | null; tags: string[]; metrics: MapDetailMetric[];
  metadata: { label: string; value: string }[]; sources?: DataSourceInfo[]; note?: string; now: number; children?: ReactNode;
}) {
  const visibleSources = sources.filter(shouldShowDataSource).filter((source, index, all) => all.findIndex(item => item.url === source.url && item.label === source.label) === index);
  const observations = new Map<string, { observedAt: string; labels: string[] }>();
  for (const metric of metrics) {
    if (!metric.observedAt) continue;
    const timestamp = observationTime(metric.observedAt);
    const key = Number.isFinite(timestamp) ? String(timestamp) : metric.observedAt;
    const group = observations.get(key);
    if (group) group.labels.push(metric.label);
    else observations.set(key, { observedAt: metric.observedAt, labels: [metric.label] });
  }
  return <section className={styles.card} aria-label={`รายละเอียด ${title}`}>
    <header className={styles.header}>
      {code && <p className={styles.code}>{code}</p>}
      <h2>{title}</h2>
      {area && <p className={styles.area}>{area}</p>}
      <div className={styles.tags}>{tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    </header>
    {!!observations.size && <div className={styles.observations} aria-label="เวลาอัปเดตข้อมูล">
      {[...observations].map(([key, { observedAt, labels }]) => {
        const daily = /^\d{4}-\d{2}-\d{2}$/.test(observedAt);
        const age = now - observationTime(observedAt);
        const recent = isRecentObservation(observedAt, now) && (daily || age <= 2 * 3600000);
        const freshness = recent ? "ข้อมูลล่าสุด" : daily ? "ข้อมูลรายวันเก่า" : age > 2 * 3600000 ? "ข้อมูลเก่ากว่า 2 ชั่วโมง" : "เวลาไม่พร้อม";
        return <div key={key} className={styles.time}>
          <Clock3 size={13} aria-hidden="true" />
          <span>{observations.size > 1 ? labels.join(" · ") : "อัปเดต"}</span>
          <time dateTime={observedAt}>{observationLabel(observedAt)}</time>
          <span className={styles.freshness}>{freshness}</span>
        </div>;
      })}
    </div>}
    <div className={styles.metrics}>
      {metrics.map(metric => {
        const available = metric.value !== null && metric.value !== undefined && metric.value !== "" && (typeof metric.value !== "number" || Number.isFinite(metric.value));
        return <article key={metric.label} className={styles.metric} data-available={available} data-kind={typeof metric.value === "string" && available ? "text" : "number"}>
          <h3>{metric.label}</h3>
          <p className={styles.reading}>{available ? <><strong>{typeof metric.value === "number" ? metric.value.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : metric.value}</strong>{metric.unit && <span>{metric.unit}</span>}</> : <strong className={styles.missing}>ยังไม่มีข้อมูล</strong>}</p>
        </article>;
      })}
    </div>
    {children}
    {note && <p className={styles.note}>{note}</p>}
    <dl className={styles.metadata}>{metadata.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    {!!visibleSources.length && <footer className={styles.sources}><h3>แหล่งข้อมูล</h3>{visibleSources.map(source => source.url ? <a key={`${source.label}-${source.url}`} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={14} aria-hidden="true" /></a> : <p key={source.label}>{source.label}</p>)}</footer>}
  </section>;
}
