"use client";

import {
  AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight, CalendarDays,
  CheckCircle2, ChevronRight, CloudRain, Database, DatabaseZap, Gauge,
  Grid3X3, History, Info, MapPinned, RefreshCw, Ruler, ShieldCheck, Sigma, Waves, X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { DroughtDataset, DroughtPayload, MonthlyData, SeasonalData, TmdData } from "@/lib/drought/types";
import { seasonalAlertLevel } from "@/lib/drought/presentation";
import styles from "./DroughtMonitor.module.css";

const tabs = [
  { id: "seasonal", label: "ความเสี่ยง 6 เดือน · สสน." },
  { id: "tmd", label: "SPEI 10 วัน · TMD" },
  { id: "monthly", label: "SPEI รายเดือน · สศก." },
] as const;
type Tab = (typeof tabs)[number]["id"];
type Tambon = SeasonalData["tambons"][number];
const referenceUrl = "https://pa-phayom-drought-monitor.dpakorn75.chatgpt.site/";
const alertLabels = { green: "ปกติ", yellow: "เฝ้าระวัง", orange: "เตรียมรับมือ", red: "ยืนยันในพื้นที่" };
function date(value: string, withTime = false) {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", ...(withTime ? { timeStyle: "short" as const } : {}), timeZone: "Asia/Bangkok" }).format(parsed) : "ไม่ระบุ";
}
function shortMonth(key: string) {
  return new Intl.DateTimeFormat("th-TH", { month: "short", year: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(`${key}-01T00:00:00+07:00`));
}
function validPeriod(data: TmdData) {
  const end = new Date(`${data.forecast.validEnd}T00:00:00+07:00`);
  if (data.forecast.validStart.slice(0, 7) === data.forecast.validEnd.slice(0, 7)) {
    const month = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(end);
    return `${Number(data.forecast.validStart.slice(8))}–${Number(data.forecast.validEnd.slice(8))} ${month}`;
  }
  return `${date(data.forecast.validStart)} – ${date(data.forecast.validEnd)}`;
}
function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function SourceLink({ href, children, outline = false }: { href: string; children: ReactNode; outline?: boolean }) {
  return <a className={outline ? "outline-button" : "link-button"} href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={15} aria-hidden="true" /></a>;
}
function PanelHeader({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: string; icon?: LucideIcon; children?: ReactNode }) {
  return <div className="panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{children ?? (Icon && <Icon aria-hidden="true" />)}</div>;
}
function Metric({ label, value, note, icon: Icon, tone = "blue", seasonal = false }: { label: string; value: ReactNode; note: string; icon: LucideIcon; tone?: string; seasonal?: boolean }) {
  if (seasonal) return <article className={`kpi-card kpi-${tone}`}><div className="kpi-icon"><Icon aria-hidden="true" /></div><div><p className="kpi-label">{label}</p><p className="kpi-value">{value}</p><p className="kpi-note">{note}</p></div></article>;
  return <article><Icon aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}
function RefreshButton({ loading, refresh, children }: { loading: boolean; refresh: () => void; children: ReactNode }) {
  return <button type="button" className="outline-button" disabled={loading} onClick={refresh}><RefreshCw size={16} className={loading ? "spinning" : ""} aria-hidden="true" />{children}</button>;
}
function SourceWarning<T>({ dataset }: { dataset: DroughtDataset<T> }) {
  if (dataset.mode === "live" && !dataset.stale && !dataset.warnings.length) return null;
  return <div className="data-alert" role="status"><AlertCircle aria-hidden="true" /><div><strong>{dataset.stale ? "ข้อมูลควรได้รับการทบทวน" : "กำลังใช้ชุดข้อมูลสำรองที่ตรวจสอบแล้ว"}</strong><p>{dataset.warnings[0] ?? "ข้อมูลพ้นรอบติดตามแล้ว โปรดตรวจสอบรอบข้อมูลก่อนใช้งาน"}</p></div></div>;
}

function TambonDetail({ tambon, months, close }: { tambon: Tambon; months: SeasonalData["months"]; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement;
    node?.showModal();
    return () => { node?.close(); if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true }); };
  }, []);
  const level = seasonalAlertLevel(tambon.forecast);
  return <dialog ref={dialog} className="detail-sheet" aria-labelledby="drought-detail-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === dialog.current) close(); }}>
    <div className="detail-content"><button type="button" className="detail-close" aria-label="ปิดรายละเอียดตำบล" onClick={close}><X size={20} /></button>
      <div className="detail-badges"><Badge tone={`status-${level}`}>{alertLabels[level]}</Badge>{tambon.watchlist && <Badge tone="watch-badge">บัญชีเฝ้าระวังจากประวัติ</Badge>}</div>
      <h2 id="drought-detail-title">ตำบล{tambon.name}</h2><p className="detail-subtitle">อำเภอ{tambon.district} · พื้นที่{tambon.zone} · รหัส {tambon.id}</p>
      <section><h3 className="detail-heading">แนวโน้ม 6 เดือน</h3>{months.map((month) => {
        const risk = tambon.forecast.find((cell) => cell.month === month.key)?.status === "drought";
        return <div className="detail-month-row" key={month.key}><span>{month.label}</span><span className={`cell ${risk ? "drought" : "norisk"}`}>{risk ? "เสี่ยงฝนน้อย" : "ไม่เข้าเกณฑ์เสี่ยง"}</span></div>;
      })}</section>
      <section className="action-box"><h3 className="detail-heading">แนวทางติดตาม</h3><ul>{level === "green" ? <><li>ติดตามประกาศรายเดือนฉบับถัดไป และข้อมูลฝนจริงในพื้นที่</li><li>ตรวจสอบแหล่งน้ำสำรองก่อนฤดูใช้น้ำสูง</li>{tambon.watchlist && <li>เพิ่มความถี่การติดตาม เพราะเป็นพื้นที่เปราะบางจากประวัติ</li>}</> : <><li>ทบทวนปริมาณน้ำต้นทุนและแผนจัดสรรน้ำของตำบล</li><li>สำรวจจุดขาดแคลนน้ำและกลุ่มผู้ใช้น้ำเปราะบาง</li><li>ยืนยันสถานการณ์ด้วยฝนจริง แหล่งน้ำ และรายงานภาคสนาม</li></>}</ul></section>
      <p className="caveat">ระดับสีในแอปเป็นเกณฑ์ปฏิบัติการเบื้องต้นจากผลคาดการณ์ สสน. ไม่ใช่ประกาศภัยทางราชการ</p>
    </div>
  </dialog>;
}

function Seasonal({ dataset }: { dataset: DroughtDataset<SeasonalData> }) {
  const { data } = dataset;
  const [district, setDistrict] = useState("all");
  const [zone, setZone] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = data.tambons.filter((tambon) => (district === "all" || tambon.district === district) && (zone === "all" || tambon.zone === zone));
  const detail = data.tambons.find((tambon) => tambon.id === selected);
  const risks = filtered.filter((tambon) => tambon.forecast.some((cell) => cell.status === "drought")).length;
  return <>
    <section className="overview-strip"><div><p className="eyebrow">รอบข้อมูล {data.source.issueLabel}</p><h2>ภาพรวม 11 ตำบล · คาดการณ์ถึง {data.months.at(-1)?.label}</h2><p>ปรับปรุงต้นทาง {date(data.source.lastModified, true)} · ตรวจสอบชุดข้อมูล {date(dataset.mode === "live" ? dataset.checkedAt : data.generatedAt, true)}</p></div>
      <div className="filters" aria-label="ตัวกรองพื้นที่"><div><label htmlFor="drought-district">อำเภอ</label><select id="drought-district" className="filter-trigger" value={district} onChange={(event) => { setDistrict(event.target.value); setSelected(null); }}><option value="all">ทุกอำเภอ</option>{Array.from(new Set(data.tambons.map((tambon) => tambon.district))).map((name) => <option key={name}>{name}</option>)}</select></div>
        <div><label htmlFor="drought-zone">โซนลุ่มน้ำ</label><select id="drought-zone" className="filter-trigger" value={zone} onChange={(event) => { setZone(event.target.value); setSelected(null); }}><option value="all">ทุกโซน</option>{["ต้นน้ำ", "กลางน้ำ", "ปลายน้ำ"].map((name) => <option key={name}>{name}</option>)}</select></div></div>
    </section>
    <SourceWarning dataset={dataset} />
    <section className="kpi-grid" aria-label="ตัวชี้วัดสำคัญ">
      <Metric seasonal label="พื้นที่ครอบคลุม" value={`${filtered.length} ตำบล`} note={`จากทั้งหมด ${data.summary.totalTambons} ตำบล`} icon={Database} />
      <Metric seasonal label="เสี่ยงใน 3 เดือนแรก" value={`${filtered.filter((tambon) => tambon.forecast.slice(0, 3).some((cell) => cell.status === "drought")).length} ตำบล`} note="เกณฑ์สีส้มสำหรับเตรียมรับมือ" tone="green" icon={ShieldCheck} />
      <Metric seasonal label="เสี่ยงภายใน 6 เดือน" value={`${risks} ตำบล`} note="ตามผลคาดการณ์ สสน. รอบนี้" tone="amber" icon={CloudRain} />
      <Metric seasonal label="บัญชีเฝ้าระวังจากประวัติ" value={`${filtered.filter((tambon) => tambon.watchlist).length} ตำบล`} note="แสดงแยกจากสถานะคาดการณ์" tone="slate" icon={History} />
    </section>
    <section className="status-callout"><div className="status-callout-icon">{risks ? <AlertTriangle /> : <CheckCircle2 />}</div><div><p className="eyebrow">สถานการณ์รอบปัจจุบัน</p><h2>{risks === 0 ? "ยังไม่พบตำบลที่เข้าเกณฑ์เสี่ยงฝนน้อย" : `พบ ${risks} ตำบลที่ต้องติดตาม`}</h2><p>{risks === 0 ? "ผลนี้หมายถึงไม่เข้าเกณฑ์ของชุดข้อมูล สสน. ในช่วงคาดการณ์ ไม่ได้หมายความว่าไม่มีโอกาสขาดแคลนน้ำ" : "ควรตรวจสอบฝนจริง แหล่งน้ำ และรายงานภาคสนามประกอบก่อนยกระดับการแจ้งเตือน"}</p></div></section>
    <div className="dashboard-grid"><section className="panel monthly-panel"><PanelHeader eyebrow="แนวโน้มรายเดือน" title="จำนวนตำบลตามสถานะคาดการณ์"><div className="legend"><span><i className="legend-norisk" />ไม่เข้าเกณฑ์</span><span><i className="legend-drought" />เสี่ยงฝนน้อย</span></div></PanelHeader>
      <div className="bar-chart" role="img" aria-label="กราฟจำนวนตำบลที่เสี่ยงและไม่เสี่ยงรายเดือน">{data.months.map((month) => {
        const drought = filtered.filter((tambon) => tambon.forecast.some((cell) => cell.month === month.key && cell.status === "drought")).length;
        const norisk = filtered.length - drought;
        return <div className="bar-column" key={month.key} title={`${month.label}: เสี่ยง ${drought} ไม่เข้าเกณฑ์ ${norisk} ตำบล`}><div className="bar-value">{drought > 0 ? `${drought} เสี่ยง` : norisk}</div><div className="bar-track"><div className="bar-drought" style={{ height: `${drought / data.summary.totalTambons * 100}%` }} /><div className="bar-norisk" style={{ height: `${norisk / data.summary.totalTambons * 100}%` }} /></div><span>{shortMonth(month.key)}</span></div>;
      })}</div>
    </section><section className="panel compare-panel"><PanelHeader eyebrow="เทียบฉบับก่อน" title="การเปลี่ยนแปลงพื้นที่เสี่ยง" icon={History} />{data.comparison.available ? <><div className="compare-number">{data.comparison.changedCells}</div><p className="compare-label">สถานะที่เปลี่ยนจากทั้งหมด {data.comparison.overlapMonths * data.summary.totalTambons} ช่องข้อมูล</p><div className="compare-split"><span><strong>{data.comparison.newlyAtRisk}</strong>เสี่ยงเพิ่ม</span><span><strong>{data.comparison.resolved}</strong>คลี่คลาย</span></div><p className="compare-note">{data.comparison.note}</p></> : <div className="empty-state"><Info aria-hidden="true" /><p>{data.comparison.note}</p></div>}</section></div>
    <section className="panel matrix-panel"><div className="panel-header matrix-header"><div><p className="eyebrow">ตารางเฝ้าระวัง 11 × 6</p><h2>สถานะรายตำบลตลอดช่วงคาดการณ์</h2><p>แตะแถวเพื่อดูรายละเอียดและแนวทางติดตาม</p></div><div className="risk-scale" aria-label="เกณฑ์ระดับแจ้งเตือน"><span className="status-green">เขียว ปกติ</span><span className="status-yellow">เหลือง เดือน 3–6</span><span className="status-orange">ส้ม 0–2 เดือน/ต่อเนื่อง</span></div></div>
      <div className="table-scroll" role="region" tabIndex={0} aria-label="ตารางเฝ้าระวังรายตำบล เลื่อนแนวนอนได้"><table className="forecast-table"><caption className="sr-only">ผลคาดการณ์ สสน. รอบ {data.source.issueLabel} จำนวน {filtered.length} ตำบล</caption><thead><tr><th className="sticky-col" scope="col">ตำบล</th><th scope="col">ระดับติดตาม</th>{data.months.map((month) => <th key={month.key} scope="col">{shortMonth(month.key)}</th>)}<th scope="col"><span className="sr-only">รายละเอียด</span></th></tr></thead><tbody>{filtered.map((tambon) => {
        const level = seasonalAlertLevel(tambon.forecast);
        return <tr key={tambon.id} onClick={() => setSelected(tambon.id)}><th scope="row" className="sticky-col tambon-cell"><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(tambon.id); }} aria-haspopup="dialog" aria-label={`ดูรายละเอียดตำบล${tambon.name}`}><strong>{tambon.name}</strong><span>{tambon.district} · {tambon.zone}</span>{tambon.watchlist && <small>เฝ้าระวังจากประวัติ</small>}</button></th><td><span className={`status-${level}`}>{alertLabels[level]}</span></td>{data.months.map((month) => { const risk = tambon.forecast.find((cell) => cell.month === month.key)?.status === "drought"; return <td key={month.key} className="month-cell"><span className={`matrix-cell ${risk ? "drought" : "norisk"}`} title={risk ? "เสี่ยงฝนน้อย" : "ไม่เข้าเกณฑ์เสี่ยง"}>{risk ? "เสี่ยง" : "ปกติ"}</span></td>; })}<td><ChevronRight size={16} color="#94a3b8" aria-hidden="true" /></td></tr>;
      })}</tbody></table></div>
      {filtered.length === 0 && <div className="empty-state"><Info aria-hidden="true" /><p>ไม่พบตำบลตามตัวกรองที่เลือก</p><button className="outline-button" type="button" onClick={() => { setDistrict("all"); setZone("all"); }}>ล้างตัวกรอง</button></div>}
    </section>
    <div className="bottom-grid"><section className="panel action-panel"><PanelHeader eyebrow="จากข้อมูลสู่การปฏิบัติ" title="สิ่งที่ควรทำตามระดับเตือน" icon={AlertTriangle} /><div className="action-list">{[
      ["green", "เขียว", "ติดตามฉบับถัดไป ตรวจฝนจริงและน้ำต้นทุนตามรอบปกติ"], ["yellow", "เหลือง", "ทบทวนแผนใช้น้ำล่วงหน้าและสำรวจกลุ่มเปราะบาง"], ["orange", "ส้ม", "เตรียมมาตรการสำรองน้ำและยืนยันสถานการณ์ในพื้นที่"], ["red", "แดง", "ใช้เมื่อมีข้อมูลภาคสนามยืนยันร่วมด้วยเท่านั้น"],
    ].map(([level, label, action]) => <div key={level}><span className={`status-${level}`}>{label}</span><p>{action}</p></div>)}</div></section>
      <section className="panel quality-panel"><PanelHeader eyebrow="คุณภาพข้อมูล" title="ตรวจสอบก่อนแสดงผล"><Badge tone={dataset.mode === "live" && !dataset.stale ? "live-badge" : "fallback-badge"}>{dataset.mode === "live" && !dataset.stale ? "ผ่าน" : "สำรอง"}</Badge></PanelHeader><dl className="quality-list"><div><dt>รายการ</dt><dd>{data.quality.records}/{data.quality.expectedRecords}</dd></div><div><dt>ตำบล</dt><dd>{data.quality.tambons}/{data.quality.expectedTambons}</dd></div><div><dt>เดือน</dt><dd>{data.quality.months}/{data.quality.expectedMonths}</dd></div><div><dt>ความใหม่</dt><dd>{Math.max(0, Math.floor((Date.parse(dataset.checkedAt) - Date.parse(data.source.lastModified)) / 86400000))} วัน</dd></div></dl><a className="source-link" href={data.source.datasetUrl} target="_blank" rel="noopener noreferrer">เปิดบัญชีข้อมูล สสน.<ArrowRight /></a></section>
    </div>
    <footer><p><strong>ข้อจำกัด:</strong> ระบบแสดงผลตามสถานะที่ สสน. เผยแพร่ โดยไม่คำนวณสูตรภัยแล้งซ้ำ และไม่ควรใช้แทนประกาศภัยทางราชการ</p><p>เกณฑ์สีเขียว–เหลือง–ส้มเป็นเกณฑ์ปฏิบัติการเบื้องต้นของระบบนี้ ส่วนสีแดงต้องมีข้อมูลฝนจริง แหล่งน้ำ หรือรายงานภาคสนามยืนยัน</p></footer>
    {detail && <TambonDetail tambon={detail} months={data.months} close={() => setSelected(null)} />}
  </>;
}

function Tmd({ dataset, loading, refresh }: { dataset: DroughtDataset<TmdData>; loading: boolean; refresh: () => void }) {
  const { data } = dataset;
  return <div className="tmd-workspace">
    <section className="spei-heading"><div><p className="eyebrow">คาดการณ์ 10 วัน · กรมอุตุนิยมวิทยา</p><h2>SPEI เฉพาะขอบเขตลุ่มน้ำป่าพะยอม</h2><p>สถิติเชิงพื้นที่จากกริดทางการ 9 × 9 กม. โดยไม่สร้างค่าจำลองในบริเวณที่ไม่มีข้อมูล</p></div><div className="spei-heading-actions"><Badge tone={dataset.mode === "live" && !dataset.stale ? "live-badge" : "fallback-badge"}><span className="status-dot" />{dataset.mode === "live" ? "กริดทางการตรวจสอบแล้ว" : "สำเนากริดทางการ"}</Badge><RefreshButton loading={loading} refresh={refresh}>อ่านผลล่าสุด</RefreshButton></div></section>
    <SourceWarning dataset={dataset} />
    <section className="tmd-period-card"><CalendarDays aria-hidden="true" /><div><p className="eyebrow">Forecast lead / valid window</p><h3>{validPeriod(data)}</h3><p>{data.forecast.lead} · {data.forecast.accumulation}</p><small>{data.forecast.limitation}</small></div></section>
    <section className="spei-kpis" aria-label="สถิติ SPEI ลุ่มน้ำ"><Metric label="ค่าเฉลี่ยลุ่มน้ำ" value={data.summary.areaWeightedMean.toFixed(2)} note="ถ่วงน้ำหนักตามพื้นที่ที่มีข้อมูล" icon={Sigma} /><Metric label="ค่าต่ำสุด" value={data.summary.minimum.toFixed(2)} note="จากเซลล์ที่ตัดขอบเขตลุ่มน้ำ" icon={Ruler} /><Metric label="กริดที่ใช้" value={`${data.cells.length} เซลล์`} note={data.source.gridResolution} icon={Grid3X3} /><Metric label="พื้นที่มีข้อมูล" value={`${data.scope.coveragePercent.toFixed(2)}%`} note={`ไม่มีข้อมูล ${data.scope.noDataPercent.toFixed(2)}%`} icon={MapPinned} /></section>
    <section className="panel tmd-area-panel"><PanelHeader eyebrow="ร้อยละของพื้นที่ลุ่มน้ำ" title="จำแนกตามระดับ SPEI"><Badge tone="scope-badge">ฐานพื้นที่ขอบเขตลุ่มน้ำทั้งหมด</Badge></PanelHeader><div className="tmd-level-grid">{[...data.thresholds.map((threshold) => ({ ...threshold, value: data.summary.categoriesPercent[threshold.category as keyof typeof data.summary.categoriesPercent] })), { category: "nodata", label: "ไม่มีข้อมูล", range: "ไม่ประมาณค่าเติม", value: data.scope.noDataPercent }].map((item) => <article key={item.category} className={`tmd-level-${item.category}`}><span>{item.label}</span><strong>{item.value.toFixed(2)}%</strong><small>{item.range}</small><div><i style={{ width: `${item.value}%` }} /></div></article>)}</div></section>
    <div className="tmd-detail-grid"><section className="panel tmd-cells-panel"><PanelHeader eyebrow="ตรวจสอบย้อนกลับได้" title="เซลล์กริดที่ตัดขอบเขตลุ่มน้ำ" icon={Grid3X3} /><div className="tmd-table-wrap" role="region" tabIndex={0} aria-label="ตารางเซลล์กริด SPEI"><table className="tmd-table"><caption className="sr-only">ค่า SPEI และพื้นที่ถ่วงน้ำหนักตามผลวิเคราะห์เว็บอ้างอิง</caption><thead><tr><th scope="col">ละติจูด</th><th scope="col">ลองจิจูด</th><th scope="col">SPEI</th><th scope="col">พื้นที่ตัดกัน</th></tr></thead><tbody>{data.cells.map((cell) => <tr key={`${cell.lat}-${cell.lon}`}><td>{cell.lat.toFixed(6)}</td><td>{cell.lon.toFixed(6)}</td><td><strong>{cell.spei.toFixed(2)}</strong></td><td>{cell.overlapKm2.toFixed(2)} ตร.กม.</td></tr>)}</tbody></table></div></section>
      <section className="panel"><PanelHeader eyebrow="แหล่งข้อมูลและวิธีคำนวณ" title="กรมอุตุนิยมวิทยา" icon={Database} /><div className="tmd-source-body"><dl><div><dt>ผลิตภัณฑ์</dt><dd>{data.source.product}</dd></div><div><dt>ปรับปรุงต้นทาง</dt><dd>{data.source.sourceUpdatedAt}</dd></div><div><dt>ขอบเขต</dt><dd>{data.scope.name}</dd></div><div><dt>วิธีสถิติ</dt><dd>{data.scope.method}</dd></div></dl><div className="source-actions"><SourceLink href={data.source.dashboardUrl}>Dashboard ทางการ</SourceLink><SourceLink outline href={data.source.dataUrl}>ไฟล์ JSON ทางการ</SourceLink><SourceLink outline href={data.source.manualUrl}>คู่มือ SPEI–MAI</SourceLink></div></div></section>
    </div>
    <section className="tmd-quality-note"><CheckCircle2 aria-hidden="true" /><div><strong>สถานะคุณภาพข้อมูล: ตรวจสอบแล้ว มีช่องว่างชายขอบ</strong><ul><li>พื้นที่ {data.scope.noDataPercent.toFixed(2)}% ของขอบเขตลุ่มน้ำไม่มีข้อมูล จึงแสดงเป็นไม่มีข้อมูลและไม่นำไปประมาณค่า</li><li>ค่าเฉลี่ยคำนวณเฉพาะพื้นที่ที่มีข้อมูล {data.scope.coveragePercent.toFixed(2)}%; ร้อยละระดับความรุนแรงใช้ฐานพื้นที่ลุ่มน้ำทั้งหมดและจึงรวมกันได้ {data.scope.coveragePercent.toFixed(2)}%</li><li>ต้นทางระบุกรอบคาดการณ์ 10 วัน แต่ไม่เผยแพร่ค่า SPEI แยกรายวันหรือชื่อช่วงสะสมแบบ SPEI-n รายเดือน</li></ul></div></section>
  </div>;
}

function Monthly({ dataset, loading, refresh }: { dataset: DroughtDataset<MonthlyData>; loading: boolean; refresh: () => void }) {
  const { data } = dataset;
  const verified = data.districts.filter((district) => district.recordStatus === "verified" && district.value !== null);
  const minimum = verified.reduce<MonthlyData["districts"][number] | null>((lowest, district) => !lowest || district.value! < lowest.value! ? district : lowest, null);
  return <div className="spei-workspace">
    <section className="spei-heading"><div><p className="eyebrow">ติดตามรายเดือน · สำนักงานเศรษฐกิจการเกษตร</p><h2>SPEI ระดับอำเภอในพื้นที่ลุ่มน้ำป่าพะยอม</h2><p>ติดตามป่าพะยอม ศรีบรรพต และควนขนุน ครอบคลุม 11 ตำบลในระบบเฝ้าระวัง</p></div><div className="spei-heading-actions"><Badge tone="snapshot-badge"><span className="status-dot" />ข้อมูลตรวจสอบบางส่วน</Badge><RefreshButton loading={loading} refresh={refresh}>ตรวจสอบข้อมูล</RefreshButton></div></section>
    <section className="spei-context-note"><Gauge aria-hidden="true" /><div><strong>ดัชนีนี้ใช้ติดตามสภาวะแห้งแล้ง ไม่ใช่พยากรณ์ 6 เดือน</strong><p>แสดงแยกจากผลคาดการณ์พื้นที่เสี่ยงฝนน้อยของ สสน. และจะไม่เปลี่ยนสถานะรายตำบลในแท็บ 6 เดือนโดยอัตโนมัติ</p></div></section>
    <section className="spei-kpis" aria-label="สรุปข้อมูล SPEI"><Metric label="รอบรายงานล่าสุด" value={data.reportMonthLabel} note="ปรับปรุงรายเดือน" icon={CalendarDays} /><Metric label="ขอบเขตติดตาม" value={`${data.scope.districts} อำเภอ`} note={`${data.scope.tambons} ตำบล`} icon={MapPinned} /><Metric label="ค่าที่ตรวจสอบแล้ว" value={`${verified.length}/${data.scope.districts}`} note="อำเภอในรอบนี้" icon={CheckCircle2} /><Metric label="ค่าต่ำสุดที่ยืนยัน" value={minimum?.value?.toFixed(3) ?? "—"} note={minimum ? `อ.${minimum.district} · ${minimum.classification}` : "ยังไม่มีค่าที่ยืนยัน"} icon={ShieldCheck} /></section>
    <section className="spei-district-grid" aria-label="ค่า SPEI รายอำเภอ">{data.districts.map((district) => {
      const confirmed = district.recordStatus === "verified" && district.value !== null;
      const tone = !confirmed ? "unavailable" : district.value! <= -2 ? "severe" : district.value! <= -1.5 ? "high" : district.value! <= -1 ? "moderate" : district.value! <= -.5 ? "slight" : "normal";
      return <article className={`spei-district-card tone-${tone}`} key={district.districtCode}><div className="district-card-heading"><div><p>รหัสอำเภอ {district.districtCode}</p><h3>อำเภอ{district.district}</h3></div><Badge tone={`spei-condition spei-condition-${tone}`}>{district.classification ?? "รอยืนยันค่า"}</Badge></div><div className="district-value"><strong>{confirmed ? district.value!.toFixed(3) : "—"}</strong><span>SPEI เฉลี่ย</span></div><p className="district-note">{district.note}</p><div className="tambon-chips" aria-label={`ตำบลในอำเภอ${district.district}`}>{district.tambons.map((tambon) => <span key={tambon}>{tambon}</span>)}</div></article>;
    })}</section>
    <div className="spei-main-grid monthly-layout"><section className="panel spei-coverage-panel"><PanelHeader eyebrow="การตีความเชิงพื้นที่" title="การเชื่อมค่าอำเภอกับ 11 ตำบล" icon={MapPinned} /><div className="spei-coverage-table-wrap" role="region" tabIndex={0} aria-label="ตารางเชื่อมอำเภอกับตำบล"><table className="spei-coverage-table"><thead><tr><th scope="col">อำเภอ</th><th scope="col">ตำบลที่ครอบคลุม</th><th scope="col">รอบล่าสุด</th><th scope="col">สถานะข้อมูล</th></tr></thead><tbody>{data.districts.map((district) => <tr key={district.districtCode}><td><strong>{district.district}</strong><small>{district.districtCode}</small></td><td>{district.tambons.join(", ")}</td><td>{district.recordStatus === "verified" && district.value !== null ? `${district.value.toFixed(3)} · ${district.classification}` : "—"}</td><td><Badge tone={district.recordStatus === "verified" ? "live-badge" : "muted-badge"}>{district.recordStatus === "verified" ? "ตรวจสอบแล้ว" : "รอ API/CSV"}</Badge></td></tr>)}</tbody></table></div><p className="coverage-note"><strong>หมายเหตุ:</strong> {data.scope.spatialNote}</p></section>
      <section className="panel"><PanelHeader eyebrow="แหล่งข้อมูล" title="รายงานต้นทาง สศก." icon={DatabaseZap} /><div className="source-panel-body"><dl><div><dt>ผลิตภัณฑ์</dt><dd>{data.source.product}</dd></div><div><dt>วิธีคำนวณ</dt><dd>{data.source.method}</dd></div><div><dt>รูปแบบที่พบ</dt><dd>Power BI / HTML</dd></div></dl><p>{data.source.message}</p><div className="source-actions"><SourceLink href={data.source.dashboardUrl}>เปิดรายงาน Power BI</SourceLink><SourceLink outline href={data.source.catalogUrl}>บัญชีข้อมูล สศก.</SourceLink></div></div></section>
    </div>
    <div className="spei-bottom-grid"><section className="panel"><PanelHeader eyebrow="เกณฑ์แห้งแล้ง" title="ระดับ SPEI ที่ใช้แสดงผล" icon={AlertTriangle} /><div className="threshold-list monthly-thresholds">{data.thresholds.map((threshold) => <div key={threshold.level}><i className={`spei-${threshold.level}`} /><strong>{threshold.label}</strong><span>{threshold.range}</span><p>{threshold.action}</p></div>)}</div></section>
      <section className="panel readiness-panel"><PanelHeader eyebrow="คุณภาพและข้อจำกัด" title="เงื่อนไขก่อนใช้เตือนภัย" icon={DatabaseZap} /><ul className="quality-warning-list">{data.quality.warnings.map((warning) => <li key={warning}><AlertCircle aria-hidden="true" /><span>{warning}</span></li>)}</ul><div className="readiness-note"><CheckCircle2 aria-hidden="true" /><p>เมื่อ สศก. เปิด CSV/API ระบบสามารถต่อยอดเป็นประวัติรายเดือนและอัปเดตทั้ง 3 อำเภออัตโนมัติได้โดยไม่เปลี่ยนเกณฑ์แสดงผล</p></div></section>
    </div>
    <p className="spei-caveat"><strong>การใช้งาน:</strong> ใช้ SPEI เป็นข้อมูลประกอบการติดตามร่วมกับฝนจริง น้ำต้นทุน และผลกระทบภาคสนาม ไม่ใช้ค่า SPEI เพียงอย่างเดียวออกสถานะแดงหรือแทนประกาศภัยทางราชการ</p>
    <p className="provenance-note">สำเนาข้อมูลรายเดือนจากเว็บอ้างอิง รอบ {data.reportMonthLabel} · บันทึกต้นฉบับ {date(data.generatedAt)} · ค่าที่ระบุว่าตรวจสอบแล้วอ้างอิงการตรวจสอบของผู้จัดทำเว็บต้นฉบับ</p>
  </div>;
}

export default function DroughtMonitor() {
  const [tab, setTab] = useState<Tab>("seasonal");
  const [payload, setPayload] = useState<DroughtPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const tabList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(false);
      try {
        const response = await fetch(`/api/drought${revision ? "?refresh=1" : ""}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data: DroughtPayload = await response.json();
        if (!data.seasonal?.data?.tambons || !data.tmd?.data?.cells || !data.monthly?.data?.districts) throw new Error();
        if (!controller.signal.aborted) setPayload(data);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  const refresh = () => setRevision((value) => value + 1);
  function moveTab(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((item) => item.id === tab);
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next].id); tabList.current?.querySelectorAll<HTMLButtonElement>("button")[next].focus();
  }
  const descriptions = {
    seasonal: "ติดตามรายตำบลจากข้อมูลคาดการณ์ฝนน้อย 6 เดือนของ สสน.",
    tmd: "ติดตาม SPEI คาดการณ์ 10 วันจากกริดทางการของกรมอุตุนิยมวิทยา",
    monthly: "ติดตาม SPEI รายเดือนระดับอำเภอจาก สศก. ครอบคลุม 11 ตำบล",
  };
  const seasonalLive = payload?.seasonal.mode === "live" && !payload.seasonal.stale;
  return <section className={styles.root} aria-label="เฝ้าระวังภัยแล้งลุ่มน้ำป่าพะยอม">
    <header className="topbar"><div className="page-shell topbar-inner"><div className="brand-mark" aria-hidden="true"><Waves /></div><div className="brand-copy"><h1>เฝ้าระวังภัยแล้งลุ่มน้ำป่าพะยอม</h1><p>{descriptions[tab]}</p></div><div className="topbar-actions">{tab === "seasonal" ? <><Badge tone={seasonalLive ? "live-badge" : "fallback-badge"}><span className="status-dot" />{seasonalLive ? "ข้อมูลต้นทางล่าสุด" : loading ? "กำลังตรวจสอบ" : "ข้อมูลสำรอง"}</Badge><RefreshButton loading={loading} refresh={refresh}><span className="refresh-label">ตรวจสอบล่าสุด</span></RefreshButton></> : <Badge tone={tab === "tmd" ? "live-badge" : "snapshot-badge"}><span className="status-dot" />{tab === "tmd" ? `TMD · ${payload ? validPeriod(payload.tmd.data) : "กำลังอ่านข้อมูล"}` : `สศก. · ${payload?.monthly.data.reportMonthLabel ?? "กำลังอ่านข้อมูล"}`}</Badge>}</div></div></header>
    <div className="page-shell dashboard-body"><div ref={tabList} className="dashboard-tabs" role="tablist" aria-label="เลือกระยะติดตามภัยแล้ง" onKeyDown={moveTab}>{tabs.map((item) => <button key={item.id} type="button" role="tab" id={`drought-tab-${item.id}`} data-state={tab === item.id ? "active" : "inactive"} aria-selected={tab === item.id} aria-controls={`drought-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
      {error && <div className="data-alert" role="alert"><AlertCircle aria-hidden="true" /><div><strong>เชื่อมต่อข้อมูลไม่ได้</strong><p>{payload ? "คงแสดงข้อมูลจากการตรวจสอบครั้งก่อน พร้อมรอบข้อมูลเดิม" : "กรุณาลองตรวจสอบข้อมูลอีกครั้ง"}</p><button type="button" className="outline-button" disabled={loading} onClick={refresh}>ลองใหม่</button><SourceLink href={referenceUrl}>เปิดเว็บอ้างอิง</SourceLink></div></div>}
      {!payload && loading && <div className="empty-state loading" role="status"><RefreshCw className="spinning" aria-hidden="true" /><p>กำลังตรวจสอบชุดข้อมูลเฝ้าระวังภัยแล้ง…</p></div>}
      {tabs.map((item) => <div key={item.id} role="tabpanel" className="dashboard-tab-content" id={`drought-panel-${item.id}`} aria-labelledby={`drought-tab-${item.id}`} hidden={tab !== item.id} tabIndex={0}>{payload && tab === item.id && <>
        {item.id === "seasonal" && <Seasonal dataset={payload.seasonal} />}
        {item.id === "tmd" && <Tmd dataset={payload.tmd} loading={loading} refresh={refresh} />}
        {item.id === "monthly" && <Monthly dataset={payload.monthly} loading={loading} refresh={refresh} />}
      </>}</div>)}
    </div>
  </section>;
}
