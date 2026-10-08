"use client";

import styles from "./PublicDashboard.module.css";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, ClipboardList, Home, Map, MapPin, Phone, Plus, RefreshCw, ShieldCheck, Waves } from "lucide-react";
import type { AppUser } from "@/lib/auth";
import type { DashboardPayload } from "@/lib/dashboard-data";
import type { SituationPayload } from "@/lib/situation/adapters";
import ReportForm from "@/components/public/ReportForm";
import ReportList from "@/components/public/ReportList";

const SituationMap = dynamic(() => import("@/components/public/SituationMap"), { ssr: false, loading: () => <div className="citizen-map-loading">กำลังเปิดแผนที่…</div> });

type Tab = "home" | "map" | "report" | "mine";
export type PublicAlert = { id: string; title: string; areaName: string; message: string; severity: string; latitude: number; longitude: number; approvedAt: string };
const tabs = [{ id: "home", label: "หน้าหลัก", icon: Home }, { id: "map", label: "แผนที่", icon: Map }, { id: "report", label: "แจ้งเหตุ", icon: Plus }, { id: "mine", label: "รายงานของฉัน", icon: ClipboardList }] as const;
const titles = { home: "ติดตามสถานการณ์ป่าพะยอม", map: "แผนที่สถานการณ์และศูนย์อพยพ", report: "แจ้งเหตุและขอความช่วยเหลือ", mine: "ติดตามรายงานของคุณ" };

export default function PublicDashboard({ data, user }: { data: DashboardPayload; user: AppUser | null }) {
  const [dashboard, setDashboard] = useState(data);
  const [now, setNow] = useState(() => Date.parse(data.updatedAt));
  const [tab, setTab] = useState<Tab>("home");
  const [situation, setSituation] = useState<SituationPayload | null>(null);
  const [alerts, setAlerts] = useState<PublicAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loginError, setLoginError] = useState("");
  useEffect(() => {
    const readTab = () => {
      const value = window.location.hash.slice(1);
      if (["home", "map", "report", "mine"].includes(value)) setTab(value as Tab);
    };
    const timer = setTimeout(() => {
      readTab();
      try { if (user && sessionStorage.getItem("ppy-report-draft")) setTab("report"); } catch { /* Storage may be disabled. */ }
      const code = new URLSearchParams(window.location.search).get("login_error");
      if (code) setLoginError(code === "disabled" ? "บัญชีถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล" : "เข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองอีกครั้ง");
    }, 0);
    window.addEventListener("hashchange", readTab);
    return () => { clearTimeout(timer); window.removeEventListener("hashchange", readTab); };
  }, [user]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setNow(Date.now());
      const results = await Promise.allSettled([
        fetch("/api/situation", { signal: controller.signal, cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return r.json() as Promise<SituationPayload>; }),
        fetch("/api/flood-alerts?public=1", { signal: controller.signal, cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return r.json(); }),
        fetch("/api/dashboard", { signal: controller.signal, cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return r.json() as Promise<DashboardPayload>; }),
      ]);
      if (controller.signal.aborted) return;
      const failures: string[] = [];
      if (results[0].status === "fulfilled") setSituation(results[0].value); else failures.push("ข้อมูลตรวจวัด");
      if (results[1].status === "fulfilled" && results[1].value.databaseConfigured) setAlerts(results[1].value.alerts); else failures.push("ประกาศยืนยัน");
      if (results[2].status === "fulfilled") setDashboard(results[2].value); else failures.push("ทะเบียนศูนย์อพยพ");
      setErrors(failures); setLoading(false);
    }
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 300_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  function navigate(id: Tab) { window.history.replaceState(null, "", `#${id}`); setTab(id); window.scrollTo({ top: 0, behavior: "instant" }); }
  const confirmedShelters = dashboard.source === "database" ? dashboard.shelters.filter((s) => s.status === "open" && s.updatedAt && now - Date.parse(s.updatedAt) <= 6 * 3600000 && Date.parse(s.updatedAt) <= now) : [];
  const waters = situation?.thaiWater.waterLevels ?? [];
  const fresh = waters.filter((s) => s.observedAt && Date.parse(s.observedAt) <= now && now - Date.parse(s.observedAt) <= 3 * 3600000);
  return <div className={`citizen-app ${styles.root}`}>
    <header className="citizen-header"><Link href="/" className="citizen-brand"><Waves size={29} /><span>ป่าพะยอม<strong>SMART BASIN</strong></span></Link><div className="citizen-header-actions"><a href="tel:1784" className="hotline"><Phone size={16} />1784</a>{user ? <a href="/api/auth/logout">ออกจากระบบ</a> : <a href="/api/auth/line/start">เข้าสู่ระบบ</a>}</div></header>
    <div className="citizen-container">
      <div className="citizen-topline"><span><ShieldCheck size={15} />ผู้ติดตามสถานการณ์{user ? ` · ${user.displayName}` : " ·"}</span><span>ลุ่มน้ำป่าพะยอม / พัทลุง</span></div>
      <nav className="citizen-desktop-nav" aria-label="เมนูหลัก">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""}><Icon size={18} />{label}</button>)}</nav>
      <main id="citizen-main">
        {loginError && <p className="citizen-error" role="alert">{loginError}</p>}
        <div className="citizen-page-heading"><div><p className="citizen-eyebrow">PA PHAYOM · FLOOD WATCH</p><h1>{titles[tab]}</h1><p>{tab === "home" ? "ดูข้อมูลล่าสุด เตรียมพร้อม และแจ้งสถานการณ์ในพื้นที่ของคุณ" : tab === "report" ? "ระบุสิ่งที่พบ เพื่อให้เจ้าหน้าที่ตรวจสอบและประสานงาน" : "ข้อมูลสำหรับติดตามและประสานงานในพื้นที่"}</p></div>{tab === "home" && <button className="citizen-refresh" aria-label="อัปเดตสถานการณ์" disabled={loading} onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={18} /></button>}</div>
        {tab === "home" && <>
          <section className="citizen-situation-banner"><div><span className="citizen-live-label"><Activity size={17} />ข้อมูลสถานการณ์</span><h2>{loading ? "กำลังเชื่อมต่อข้อมูลล่าสุด" : errors.length ? "ข้อมูลบางส่วนยังไม่พร้อม" : "ติดตามข้อมูลตรวจวัดและประกาศ"}</h2><p>ไม่มีรายงาน ไม่ได้ยืนยันว่าไม่มีน้ำท่วม ตรวจสอบเวลาและแหล่งข้อมูลก่อนตัดสินใจ</p></div><button className="citizen-primary" onClick={() => navigate("report")}><Plus size={19} />แจ้งเหตุในพื้นที่</button></section>
          {errors.length > 0 && <p className="citizen-data-note" role="status">ยังอ่าน {errors.join(" และ ")} ไม่ได้ ลองอัปเดตอีกครั้ง</p>}
          <div className="citizen-overview"><section className="citizen-announcements"><div className="citizen-section-heading"><h2>ประกาศที่ยืนยันแล้ว</h2><span className="citizen-count">{alerts.length}</span></div>{loading && !alerts.length ? <p>กำลังอ่านประกาศ…</p> : !alerts.length ? <div className="citizen-empty-inline"><ShieldCheck size={23} /><p>{errors.includes("ประกาศยืนยัน") ? "ยังไม่สามารถตรวจสอบประกาศได้" : "ยังไม่มีประกาศที่ยืนยันและมีผลอยู่"}</p><small>ติดตามประกาศจากหน่วยงานในพื้นที่ควบคู่กัน</small></div> : alerts.map((alert) => <article key={alert.id} className={`citizen-alert severity-${alert.severity}`}><span>{alert.severity === "critical" ? "วิกฤต" : alert.severity === "warning" ? "เตือนภัย" : "เฝ้าระวัง"} · {alert.areaName}</span><h3>{alert.title}</h3><p>{alert.message}</p><small>ยืนยัน {new Date(alert.approvedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small></article>)}</section><section className="citizen-readiness"><h2>เตรียมพร้อมในพื้นที่</h2><button onClick={() => navigate("map")}><MapPin size={22} /><span><b>แผนที่และศูนย์อพยพ</b><small>{confirmedShelters.length ? `${confirmedShelters.length} แห่งยืนยันเปิดภายใน 6 ชม.` : "ยังไม่มีศูนย์ที่ยืนยันเปิดล่าสุด"}</small></span><ArrowUpRight size={20} /></button><a href="tel:1784"><Phone size={22} /><span><b>ติดต่อ ปภ. 1784</b><small>ประสานเหตุภัยพิบัติและขอความช่วยเหลือ</small></span><ArrowUpRight size={20} /></a></section></div>
          <section className="citizen-stations"><div className="citizen-section-heading"><div><h2>ระดับน้ำจากสถานีตรวจวัด</h2><p>แหล่งข้อมูล ThaiWater · {fresh.length} สถานีมีข้อมูลไม่เกิน 3 ชั่วโมง</p></div><button className="citizen-text-button" onClick={() => navigate("map")}>ดูบนแผนที่ <ArrowUpRight size={16} /></button></div>{waters.length ? <div className="citizen-station-list">{waters.slice(0, 8).map((s) => <article key={s.id}><div><h3>{s.name}</h3><p>{s.river || s.district}</p><small>ตรวจวัด {new Date(s.observedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small></div><div><strong>{s.waterLevelMsl === null ? "—" : s.waterLevelMsl.toFixed(2)}</strong><small>ม.รทก.</small><span>{fresh.includes(s) ? "ข้อมูลไม่เกิน 3 ชม." : "ข้อมูลเก่าหรือเวลาไม่พร้อม"}</span></div></article>)}</div> : <div className="citizen-empty-inline"><Waves size={24} /><p>{loading ? "กำลังอ่านข้อมูลสถานี…" : "ยังไม่มีค่าระดับน้ำที่อ่านได้"}</p><small>ค่าที่หายจะไม่ถูกเติมเป็นศูนย์หรือจัดเป็นสถานการณ์ปกติ</small></div>}</section>
          <div className="citizen-source-note">อัปเดตขณะเปิดหน้า ทุก 5 นาที{ situation ? ` · ตรวจแหล่งข้อมูล ${new Date(situation.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}` : "" }<details><summary>แหล่งข้อมูลและความพร้อม</summary>{situation?.sources.map((s) => <p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> · {s.status === "ok" ? "เชื่อมต่อได้" : "ข้อมูลไม่พร้อม"} · {s.message}</p>)}</details></div>
        </>}
        {tab === "map" && <section className="citizen-map-section"><p className="citizen-data-note">แสดงสถานีที่มีพิกัด ประกาศที่อนุมัติแล้ว และศูนย์ที่ยืนยันเปิดภายใน 6 ชั่วโมง เส้นทางเข้าถึงต้องตรวจสอบกับเจ้าหน้าที่พื้นที่</p><SituationMap waters={waters} alerts={alerts} shelters={confirmedShelters} /><div className="citizen-map-legend"><span>● สถานีระดับน้ำ</span><span>△ ประกาศเฝ้าระวัง / เตือนภัย</span><span>＋ ศูนย์อพยพยืนยันเปิดล่าสุด</span></div>{!confirmedShelters.length && <p>ยังไม่มีศูนย์ที่ยืนยันเปิดล่าสุด ติดต่อเจ้าหน้าที่พื้นที่หรือ ปภ. 1784</p>}{confirmedShelters.map((s) => <article className="citizen-shelter" key={s.id}><b>{s.name}</b><span>ความจุตามทะเบียน {s.capacity} คน · ยังไม่ใช่จำนวนที่ว่าง</span><small>ยืนยัน {new Date(s.updatedAt!).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small></article>)}</section>}
        {tab === "report" && <ReportForm user={user} />}
        {tab === "mine" && <ReportList user={user} />}
      </main>
      <footer className="citizen-footer">SMART BASIN · ข้อมูลเพื่อการติดตามสถานการณ์ลุ่มน้ำป่าพะยอม<a href="/privacy">ความเป็นส่วนตัว</a></footer>
    </div>
    <nav className="citizen-mobile-nav" aria-label="เมนูหลักบนมือถือ">{tabs.map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={21} /><span>{label}</span></button>)}</nav>
  </div>;
}
