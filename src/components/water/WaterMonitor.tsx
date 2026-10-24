"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, RefreshCw, Waves } from "lucide-react";
import { dailyMethods, dailyWater, hourlyWater, latestWater, waterChange, waterStations, waterTime, HOUR, WATER_REFERENCE, type DailyMethod, type WaterMetric, type WaterMode, type WaterSeries } from "@/lib/water/series";
import { rainZoneLabels } from "@/lib/rain-stations";
import WaterFlowSelector from "./WaterFlowSelector";
import WaterChart, { waterDate, waterValue } from "./WaterChart";
import styles from "./WaterMonitor.module.css";

type LoadResult = { data: WaterSeries | null; error: string; checked: number };
const dataCache = new Map<string, LoadResult>();
function friendlyIssue(message: string) {
  if (/429/.test(message)) return "ต้นทางจำกัดการเรียกประวัติบางช่วง แสดงข้อมูลที่รับได้และคงช่องว่างไว้";
  if (/ตลิ่ง|เกณฑ์/.test(message)) return "ยังไม่มีเกณฑ์ระดับน้ำที่ยืนยันได้ครบสำหรับสถานีนี้";
  return "ข้อมูลต้นทางบางส่วนยังไม่พร้อม แสดงเฉพาะค่าที่รับได้";
}
function freshness(t: number | undefined, now: number) { return t === undefined ? "ไม่มีค่าตรวจวัด" : now - t > 2 * HOUR ? "ข้อมูลเก่ากว่า 2 ชม." : t > now + 5 * 60000 ? "เวลาข้อมูลผิดปกติ" : "ข้อมูลล่าสุด"; }

export default function WaterMonitor({ onBack }: { onBack?: () => void }) {
  const chartContainer = useRef<HTMLDivElement>(null);
  const [contextCode, setContextCode] = useState<string | null>(null);
  const [stationCode, setStationCode] = useState("TSL11");
  const [zone, setZone] = useState("all"), [query, setQuery] = useState("");
  const [mode, setMode] = useState<WaterMode>("hourly"), [metric, setMetric] = useState<WaterMetric>("h");
  const [hours, setHours] = useState(24), [days, setDays] = useState(7);
  const [dailyMethod, setDailyMethod] = useState<DailyMethod>("at06");
  const [showThresholds, setShowThresholds] = useState(false);
  const [revision, setRevision] = useState(0), [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState<Record<string, LoadResult>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const station = waterStations.find(item => item.code === stationCode)!;
  const requestedDays = mode === "daily" ? days : 7;
  const key = `${stationCode}:${requestedDays}`;
  const result = loaded[key], data = result?.data ?? null;


  useEffect(() => {
    const controller = new AbortController();
    async function load(code: string) {
      const cacheKey = `${code}:${requestedDays}`, cached = dataCache.get(cacheKey);
      if (cached && Date.now() - cached.checked < 300000 && revision === 0) {
        if (!controller.signal.aborted) {
          setLoaded(previous => ({ ...previous, [cacheKey]: cached }));
          if (code === stationCode) setPendingKey(null);
        }
        return;
      }
      try {
        const response = await fetch(`/api/water-series?station=${encodeURIComponent(code)}&days=${requestedDays}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]), cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "เชื่อมต่อข้อมูลไม่สำเร็จ");
        if (payload.station?.code !== code || !Array.isArray(payload.rows)) throw new Error("อ่านข้อมูลสถานีไม่สำเร็จ");
        const value: LoadResult = { data: payload, error: "", checked: Date.now() };
        if (!controller.signal.aborted) {
          if (dataCache.size > 32) dataCache.delete(dataCache.keys().next().value!);
          dataCache.set(cacheKey, value); setLoaded(previous => ({ ...previous, [cacheKey]: value }));
        }
      } catch (error) {
        if (!controller.signal.aborted) setLoaded(previous => ({ ...previous, [cacheKey]: { data: previous[cacheKey]?.data ?? cached?.data ?? null, error: error instanceof Error ? "เชื่อมต่อข้อมูลประวัติไม่สำเร็จ กรุณาลองอัปเดตอีกครั้ง" : "เชื่อมต่อข้อมูลไม่สำเร็จ", checked: Date.now() } }));
      } finally {
        if (!controller.signal.aborted && code === stationCode) setPendingKey(null);
      }
    }
    async function run() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setPendingKey(`${stationCode}:${requestedDays}`);
      // Fetch the selected station first; compare the rest in small batches.
      const queue = [stationCode, ...waterStations.filter(item => item.code !== stationCode).map(item => item.code)];
      for (let i = 0; i < queue.length && !controller.signal.aborted; i += 3) await Promise.all(queue.slice(i, i + 3).map(load));
    }
    void run();
    return () => controller.abort();
  }, [requestedDays, revision, stationCode]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") { setNow(Date.now()); setRevision(value => value + 1); } }, 300000);
    return () => clearInterval(timer);
  }, []);

  const points = useMemo(() => mode === "hourly" ? hourlyWater(data?.rows ?? [], hours, metric, now) : dailyWater(data?.rows ?? [], days, metric, dailyMethod, now), [data, mode, hours, metric, now, days, dailyMethod]);
  const valid = points.filter(point => point.value !== null), latest = latestWater(data?.rows ?? [], metric);
  const unit = metric === "q" ? "ลบ.ม./วินาที" : station.unit;
  const lastInRange = valid[valid.length - 1];
  const values = valid.map(point => point.value!);
  const thresholds = metric === "h" && showThresholds && data ? Object.entries(data.thresholds).map(([kind, value]) => ({ label: kind === "warning" ? "เฝ้าระวัง" : kind === "critical" ? "วิกฤต" : "ตลิ่ง", value })) : [];
  const issues = [...new Set((data?.errors ?? []).map(friendlyIssue))];

  function download() {
    const rows = [["station", "metric", "unit", "mode", "timestamp_utc", "value", "observed_at_utc", "coverage_percent", "source"], ...points.map(point => [stationCode, metric, unit, mode === "hourly" ? "last_observation_in_hour" : dailyMethod, new Date(point.t).toISOString(), point.value ?? "", point.observedAt ? new Date(point.observedAt).toISOString() : "", point.coverage ?? "", station.source])];
    const csv = "\ufeff" + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${stationCode}-${mode}-${metric}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={styles.root} aria-label="ระดับน้ำและน้ำท่า">
    <header className={styles.pageHeader}><div>{onBack && <button className={styles.back} type="button" onClick={onBack}><ArrowLeft size={15} />กลับแผนที่</button>}<p className={styles.eyebrow}>ติดตามการตรวจวัด · ป่าพะยอมและคลองท่าแนะ</p><h1>ระดับน้ำ–น้ำท่า</h1><p>เลือกสถานี ความถี่ และช่วงเวลา เพื่อดูแนวโน้มที่ต้องการ</p></div><button className={styles.refresh} disabled={pendingKey === key} type="button" onClick={() => { setNow(Date.now()); setRevision(value => value + 1); }}><RefreshCw size={16} />{pendingKey === key ? "กำลังอัปเดต…" : "อัปเดตข้อมูล"}</button></header>
    <WaterFlowSelector selectedCode={contextCode ?? stationCode} onSelect={code => {
      if (waterStations.some(item => item.code === code)) {
        setStationCode(code); setContextCode(null);
        requestAnimationFrame(() => chartContainer.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }));
      }
      else setContextCode(code);
    }} series={Object.fromEntries(waterStations.map(item => [item.code, loaded[`${item.code}:${requestedDays}`]?.data]))}
      zone={zone} onZone={setZone} query={query} onQuery={setQuery} revision={revision} />
    <div className={styles.layout}>
      <div ref={chartContainer} className={styles.main} hidden={Boolean(contextCode)}>
        <div className={styles.controls}>
          <div className={styles.controlRow}><div className={styles.segments} role="group" aria-label="ความถี่ข้อมูลน้ำ">{(["hourly", "daily"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{value === "hourly" ? "รายชั่วโมง" : "รายวัน"}</button>)}</div><div className={styles.metricSelect} role="group" aria-label="ตัวแปรข้อมูลน้ำ"><button type="button" aria-pressed={metric === "h"} onClick={() => setMetric("h")}>ระดับน้ำ H</button><button type="button" aria-pressed={metric === "q"} onClick={() => setMetric("q")}>อัตราการไหล Q</button></div></div>
          <div className={styles.periodRow}><span>ย้อนหลัง</span><div role="group" aria-label="ช่วงย้อนหลังข้อมูลน้ำ">{(mode === "hourly" ? [24, 48, 72, 168] : [7, 30, 90, 180]).map(value => <button key={value} type="button" aria-pressed={(mode === "hourly" ? hours : days) === value} onClick={() => mode === "hourly" ? setHours(value) : setDays(value)}>{mode === "hourly" ? value === 168 ? "7 วัน" : `${value} ชม.` : `${value} วัน`}</button>)}</div>{mode === "daily" && <label className={styles.dailyMethod}>ค่ารายวัน<select aria-label="วิธีแสดงค่ารายวัน" value={dailyMethod} onChange={event => setDailyMethod(event.target.value as DailyMethod)}>{dailyMethods.map(method => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>}</div>
        </div>
        {result?.error && <p className={styles.notice} role="alert">{result.error}{data && " · แสดงข้อมูลที่รับไว้ก่อนหน้า"}</p>}
        <article className={styles.chartPanel}>
          <header className={styles.chartHeader}><div><p className={styles.code}>{station.code} · {rainZoneLabels[station.zone]}</p><h2>{station.name}</h2><p>{station.source}</p></div><span className={styles.dataBadge}>{result ? freshness(latest?.t, now) : "กำลังอ่านข้อมูล…"}</span></header>
          <div className={styles.summary}><div><span>{metric === "h" ? "ระดับน้ำ" : "อัตราการไหล"}ล่าสุดในช่วง</span><strong>{waterValue(lastInRange?.value)}<small>{unit}</small></strong><p>{lastInRange ? waterDate(lastInRange.observedAt ?? lastInRange.t, mode === "hourly") : "ไม่มีค่าที่ผ่านเงื่อนไข"}</p></div><dl><div><dt>ต่ำสุด / สูงสุดในกราฟ</dt><dd>{valid.length ? `${waterValue(Math.min(...values))} / ${waterValue(Math.max(...values))}` : "—"}</dd></div><div><dt>ข้อมูลที่แสดงได้</dt><dd>{valid.length} / {points.length} {mode === "hourly" ? "ชั่วโมง" : "วัน"}</dd></div><div><dt>เปลี่ยนแปลงในช่วง</dt><dd>{valid.length > 1 ? waterValue(valid[valid.length - 1].value! - valid[0].value!) : "—"} {unit}</dd></div></dl></div>
          {!result ? <div className={styles.chartEmpty} role="status"><Waves size={25} /><strong>กำลังอ่านประวัติ {station.code}…</strong></div> : <WaterChart key={`${key}:${mode}:${metric}:${hours}:${dailyMethod}`} points={points} unit={unit} hourly={mode === "hourly"} thresholds={thresholds} />}
          <div className={styles.chartActions}><label><input type="checkbox" checked={showThresholds} disabled={metric !== "h" || !Object.keys(data?.thresholds ?? {}).length} onChange={event => setShowThresholds(event.target.checked)} />แสดงเส้นเกณฑ์ต้นทาง</label><button type="button" onClick={download} disabled={!data}><ArrowDownToLine size={15} />ดาวน์โหลด CSV</button></div>
          <div className={styles.qualityNote}><p>{mode === "daily" ? `${dailyMethods.find(method => method.id === dailyMethod)!.label} · วันตามเวลาประเทศไทย` : "ใช้ค่าตรวจวัดสุดท้ายในแต่ละชั่วโมง · เวลาประเทศไทย"}</p>{data && <p>{data.servedFromArchive ? "อ่านประวัติที่บริการต้นทางเก็บไว้" : data.sourceAvailable ? "รับข้อมูลจากต้นทางสำเร็จ" : "ต้นทางบางส่วนไม่พร้อม"}{data.fetchedAt && ` · รับจากหน่วยงาน ${waterDate(waterTime(data.fetchedAt))}`} · ไม่เติมค่าที่หายด้วยศูนย์</p>}{issues.map(issue => <p key={issue}>{issue}</p>)}</div>
        </article>
        <details className={styles.dataTable}><summary>ตารางค่าที่แสดงในกราฟ · {points.length} รายการ</summary><div><table><thead><tr><th>เวลา / วันที่</th><th>ค่า ({unit})</th><th>เวลาตรวจวัด / ความครบถ้วน</th></tr></thead><tbody>{points.map(point => <tr key={point.t}><td>{waterDate(point.t, mode === "hourly")}</td><td>{waterValue(point.value)}</td><td>{point.observedAt ? waterDate(point.observedAt) : point.coverage !== undefined ? `${Math.round(point.coverage)}%${point.partial ? " · วันยังไม่จบ" : ""}` : "ไม่มีข้อมูล"}</td></tr>)}</tbody></table></div></details>
        <section className={styles.comparison}><header><h2>เทียบสถานีในพื้นที่</h2><p>กดสถานีเพื่อเปลี่ยนกราฟ · ระดับอ้างอิงแต่ละสถานีอาจต่างกัน</p></header><div className={styles.tableScroll}><table><thead><tr><th>สถานี</th><th>{metric === "h" ? "ระดับน้ำ" : "อัตราการไหล"}ล่าสุด</th><th>เวลาตรวจวัด</th><th>{mode === "hourly" ? "เปลี่ยน 1 ชม." : "ค่ารายวันล่าสุด"}</th><th>{mode === "hourly" ? "3 ชม." : "ต่ำสุด–สูงสุดรายวัน"}</th><th>{mode === "hourly" ? "6 ชม." : "วันที่มีค่า"}</th><th>สถานะข้อมูล</th></tr></thead><tbody>{waterStations.filter(item => zone === "all" || item.zone === zone).map(item => {
          const record = loaded[`${item.code}:${requestedDays}`], rows = record?.data?.rows ?? [], row = latestWater(rows, metric);
          const dailyPoints = mode === "daily" ? dailyWater(rows, days, metric, dailyMethod, now).filter(point => point.value !== null) : [];
          return <tr key={item.code} data-selected={item.code === stationCode}><th><button type="button" onClick={() => setStationCode(item.code)}>{item.code}<small>{item.name}</small></button></th><td>{waterValue(row?.[metric])}<small>{metric === "q" ? "ลบ.ม./วินาที" : item.unit}</small></td><td>{row ? waterDate(row.t) : "—"}</td>{mode === "hourly" ? [1, 3, 6].map(h => <td key={h}>{waterValue(waterChange(rows, h, metric, now))}</td>) : <><td>{waterValue(dailyPoints[dailyPoints.length - 1]?.value)}</td><td>{dailyPoints.length ? `${waterValue(Math.min(...dailyPoints.map(point => point.value!)))} – ${waterValue(Math.max(...dailyPoints.map(point => point.value!)))}` : "—"}</td><td>{dailyPoints.length} / {days}</td></>}<td>{record ? freshness(row?.t, now) : "กำลังอ่าน…"}</td></tr>;
        })}</tbody></table></div></section>
        <details className={styles.sourceInfo}><summary>แหล่งข้อมูลและระดับอ้างอิงของ {stationCode}</summary><p>{station.datum}</p><p>{station.note}</p><p>เส้นเกณฑ์เป็นค่าจากชุดข้อมูลของสถานีเดียวกัน และยังไม่ใช่ประกาศเตือนภัยจากเจ้าหน้าที่</p><a href={data?.sourceURL ?? `${WATER_REFERENCE}/#waterview`} target="_blank" rel="noopener noreferrer">เปิดต้นทาง · {station.source} ↗</a><a href={`${WATER_REFERENCE}/#waterview`} target="_blank" rel="noopener noreferrer">บริการประวัติ · Pa Phayom Water Watch ↗</a></details>
      </div>
    </div>
  </section>;
}
