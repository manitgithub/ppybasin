"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Ban, Plus, RefreshCw } from "lucide-react";
import type { AppUser } from "@/lib/auth";
import { canManageRoads } from "@/lib/reports";
import type { RoadClosure } from "@/lib/road-closures";
import type { ReportLocation } from "./ReportLocationPicker";
import styles from "@/components/dashboard/views/ReportsWorkspace.module.css";
const Picker = dynamic(() => import("./RoadSegmentPicker"), { ssr: false, loading: () => <div className="citizen-map-loading">กำลังโหลดแผนที่…</div> });
const timeFormat = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

export default function RoadClosureManager({ user, onCount }: { user: AppUser; onCount?: (count: number) => void }) {
  const [a, setA] = useState<ReportLocation | null>(null);
  const [b, setB] = useState<ReportLocation | null>(null);
  const [closures, setClosures] = useState<RoadClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/road-closures", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setClosures(data.closures); onCount?.(data.closures.length);
    } finally { setLoading(false); }
  }, [onCount]);
  const allowed = canManageRoads(user);
  useEffect(() => {
    if (!allowed) return;
    const timer = setTimeout(() => void load().catch(e => setError(e.message)), 0);
    return () => clearTimeout(timer);
  }, [load, allowed]);
  if (!allowed) return null;
  async function save(body: object, method: "POST" | "PATCH") {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/road-closures", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(method === "POST" ? "บันทึกปิดถนนแล้ว ช่วง A–B แสดงบนแผนที่และใช้หลีกเลี่ยงในการนำทาง" : "บันทึกเปิดถนนแล้ว");
      if (method === "POST") { setA(null); setB(null); setFormOpen(false); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <section className={styles.workspace} aria-labelledby="road-closures-title">
    <div className={styles.header}>
      <div><h2 id="road-closures-title">ถนนที่ปิดอยู่</h2><p>ช่วง A–B ที่บันทึกจะแสดงบนแผนที่สาธารณะทันที และระบบนำทางอพยพจะหลีกเลี่ยงช่วงนี้</p></div>
      <div className={styles.actionButtons}>
        <button type="button" className={styles.btn} onClick={() => void load().catch(e => setError(e.message))} disabled={loading}><RefreshCw size={17} aria-hidden />โหลดใหม่</button>
        {!formOpen && <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setFormOpen(true)}><Plus size={17} aria-hidden />แจ้งปิดถนนใหม่</button>}
      </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}

    {formOpen && <form className={styles.closureForm} onSubmit={e => {
      e.preventDefault();
      if (!a || !b) { setError("กรุณาเลือกจุด A และ B ให้ครบ"); return; }
      const data = new FormData(e.currentTarget);
      void save({ name: data.get("name"), description: data.get("description"), aLat: a.lat, aLng: a.lng, bLat: b.lat, bLng: b.lng }, "POST");
    }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 750 }}>แจ้งปิดถนนใหม่</h3>
      <label>ชื่อถนน / ช่วงถนน<input name="name" required minLength={3} maxLength={150} placeholder="เช่น ถนนสาย 4 ช่วงหน้าตลาด" /></label>
      <fieldset className={styles.segment}><legend>ช่วงถนนที่ปิด — แตะจุด A แล้วแตะจุด B บนแผนที่</legend><Picker a={a} b={b} onChange={(nextA, nextB) => { setA(nextA); setB(nextB); }} /></fieldset>
      <label>รายละเอียดน้ำท่วม / เหตุที่ปิดถนน<textarea name="description" required minLength={5} maxLength={2000} rows={3} placeholder="เช่น น้ำท่วมผิวถนนประมาณ 40 ซม. รถเล็กผ่านไม่ได้" /></label>
      <div className={styles.actionButtons}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || !a || !b}><Ban size={17} aria-hidden />{busy ? "กำลังบันทึก…" : "ยืนยันปิดถนนช่วง A–B"}</button>
        <button type="button" className={`${styles.btn} ${styles.btnQuiet}`} onClick={() => { setFormOpen(false); setA(null); setB(null); }}>ยกเลิก</button>
      </div>
      {(!a || !b) && <p className={styles.hint}>แตะแผนที่ให้ครบทั้งจุด A และจุด B ก่อนจึงจะยืนยันได้</p>}
    </form>}

    {loading && !closures.length ? <p role="status">กำลังโหลดข้อมูลถนน…</p>
      : !closures.length ? <div className={styles.empty}><h3>ไม่มีถนนที่ปิดอยู่</h3><p>กด “แจ้งปิดถนนใหม่” เมื่อพบช่วงถนนที่รถผ่านไม่ได้</p></div>
      : <div className={styles.closureList}>{closures.map(c => <article className={styles.closure} key={c.id}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <span className={`${styles.badge} ${styles["status-rejected"]}`}><Ban size={14} aria-hidden />ปิดถนน</span>
          <h3 style={{ marginTop: 6 }}>{c.name}</h3>
          <p>{c.description}</p>
          <p>บันทึกเมื่อ {timeFormat(c.createdAt)} · A {c.aLat.toFixed(4)}, {c.aLng.toFixed(4)} → B {c.bLat.toFixed(4)}, {c.bLng.toFixed(4)}</p>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnSafe}`} disabled={busy} onClick={() => { if (window.confirm(`ยืนยันว่าน้ำลดและเปิด “${c.name}” แล้ว?`)) void save({ id: c.id }, "PATCH"); }}>ยืนยันน้ำลด เปิดถนน</button>
      </article>)}</div>}
  </section>;
}
