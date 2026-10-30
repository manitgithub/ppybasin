"use client";

import styles from "./PublicDashboard.module.css";
import { DataSources } from "@/components/DataSource";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChartNoAxesCombined, ClipboardList, Home, Navigation, Phone, Plus, ShieldCheck, Sun, Waves } from "lucide-react";
import type { AppUser } from "@/lib/auth";
import type { DashboardPayload } from "@/lib/dashboard-data";
import type { SituationPayload } from "@/lib/situation/adapters";
import ReportForm from "@/components/public/ReportForm";
import ReportList from "@/components/public/ReportList";
import PublicMapHome from "@/components/public/PublicMapHome";
import DroughtMonitor from "@/components/DroughtMonitor";

const WindyViewer = dynamic(() => import("./WindyViewer"), { loading: () => <p role="status">กำลังเปิด Windy…</p> });

const ForecastMonitor = dynamic(() => import("@/components/forecast/ForecastMonitor"), { ssr: false, loading: () => <p role="status">กำลังเปิดหน้าคาดการณ์…</p> });

const WaterMonitor = dynamic(() => import("@/components/water/WaterMonitor"), { ssr: false, loading: () => <p role="status">กำลังเปิดหน้าระดับน้ำ–น้ำท่า…</p> });

const SituationMap = dynamic(() => import("@/components/public/SituationMap"), { ssr: false, loading: () => <div className="citizen-map-loading">กำลังเปิดแผนที่…</div> });

type Tab = "windy" | "forecast" | "water" | "home" | "map" | "nearby" | "report" | "mine" | "drought";
export type PublicAlert = { id: string; title: string; areaName: string; message: string; severity: string; latitude: number; longitude: number; approvedAt: string };
const tabs = [{ id: "home", label: "หน้าหลัก", icon: Home }, { id: "water", label: "ระดับน้ำ–น้ำท่า", icon: Waves }, { id: "forecast", label: "คาดการณ์", icon: ChartNoAxesCombined }, { id: "drought", label: "เฝ้าระวังภัยแล้ง", icon: Sun }, { id: "nearby", label: "ศูนย์ใกล้ฉัน", icon: Navigation }, { id: "report", label: "แจ้งเหตุ", icon: Plus }, { id: "mine", label: "รายงานของฉัน", icon: ClipboardList }] as const;
const titles = { windy: "Windy", forecast: "คาดการณ์", water: "ระดับน้ำ–น้ำท่า", drought: "เฝ้าระวังภัยแล้ง", home: "ติดตามสถานการณ์ป่าพะยอม", map: "แผนที่สถานการณ์และศูนย์อพยพ", report: "แจ้งเหตุและขอความช่วยเหลือ", mine: "ติดตามรายงานของคุณ", nearby: "ศูนย์อพยพใกล้ฉัน" };

export default function PublicDashboard({ data, user, embedded = false }: { data: DashboardPayload; user: AppUser | null; embedded?: boolean }) {
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
    const updateClock = () => setNow(Date.now());
    const timer = window.setInterval(updateClock, 30_000);
    document.addEventListener("visibilitychange", updateClock);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", updateClock); };
  }, []);
  useEffect(() => {
    if (embedded) return;
    const readTab = () => {
      const hash = window.location.hash.slice(1);
      const value = hash === "waterview" ? "water" : hash;
      if (["home", "map", "nearby", "report", "mine", "drought", "water", "forecast", "windy"].includes(value)) setTab(value as Tab);
    };
    const timer = setTimeout(() => {
      readTab();
      try { if (user && sessionStorage.getItem("ppy-report-draft")) setTab("report"); } catch { /* Storage may be disabled. */ }
      const code = new URLSearchParams(window.location.search).get("login_error");
      if (code) setLoginError(code === "disabled" ? "บัญชีถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล" : "เข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองอีกครั้ง");
    }, 0);
    window.addEventListener("hashchange", readTab);
    return () => { clearTimeout(timer); window.removeEventListener("hashchange", readTab); };
  }, [user, embedded]);
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
  if (embedded || tab === "home" || tab === "nearby") return <PublicMapHome embedded={embedded} nearby={tab === "nearby"} signedIn={!!user} situation={situation} now={now} onRefresh={() => setRefresh((value) => value + 1)} alerts={alerts} loading={loading} errors={errors} loginError={loginError} navigate={navigate} />;
  return <div className={`citizen-app ${styles.root} ${tab === "water" ? styles.waterWorkspace : ""} ${tab === "report" ? styles.fullscreen : ""} ${tab === "drought" ? styles.drought : (tab === "water" || tab === "forecast" || tab === "windy") ? styles.water : ""}`}>
    <header className="citizen-header"><Link href="/" className="citizen-brand"><Waves size={29} /><span>ป่าพะยอม<strong>SMART BASIN</strong></span></Link><div className="citizen-header-actions"><a href="tel:1784" className="hotline"><Phone size={16} />1784</a>{user ? <a href="/api/auth/logout">ออกจากระบบ</a> : <a href="/api/auth/line/start">เข้าสู่ระบบ</a>}</div></header>
    <div className="citizen-container">
      <div className="citizen-topline"><span><ShieldCheck size={15} />ผู้ติดตามสถานการณ์{user ? ` · ${user.displayName}` : " ·"}</span><span>ลุ่มน้ำป่าพะยอม / พัทลุง</span></div>
      <nav className="citizen-desktop-nav" aria-label="เมนูหลัก">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""}><Icon size={18} />{label}</button>)}</nav>
      <main id="citizen-main">
        {loginError && <p className="citizen-error" role="alert">{loginError}</p>}
        {tab !== "drought" && tab !== "water" && tab !== "forecast" && tab !== "windy" && <div className="citizen-page-heading"><div><p className="citizen-eyebrow">PA PHAYOM · FLOOD WATCH</p><h1>{titles[tab]}</h1><p>{tab === "report" ? "ระบุสิ่งที่พบ เพื่อให้เจ้าหน้าที่ตรวจสอบและประสานงาน" : "ข้อมูลสำหรับติดตามและประสานงานในพื้นที่"}</p></div></div>}
        {tab === "map" && <section className="citizen-map-section"><p className="citizen-data-note">แสดงสถานีที่มีพิกัด ประกาศที่อนุมัติแล้ว และศูนย์ที่ยืนยันเปิดภายใน 6 ชั่วโมง เส้นทางเข้าถึงต้องตรวจสอบกับเจ้าหน้าที่พื้นที่</p><SituationMap waters={waters} alerts={alerts} shelters={confirmedShelters} /><DataSources sources={[
            { label: "ThaiWater / สสน. · สถานีระดับน้ำ", url: situation?.sources.find((source) => source.id === "thaiwater-waterlevel")?.url ?? "https://api-v3.thaiwater.net/api/v1/thaiwater30/provinces/waterlevel?province_code=93" },
            { label: "ประกาศที่เจ้าหน้าที่ตรวจสอบและอนุมัติในระบบ", url: "/api/flood-alerts?public=1" },
            { label: dashboard.source === "database" ? "ทะเบียนศูนย์อพยพในระบบ" : "ข้อมูลศูนย์อพยพสำรอง / ตัวอย่างในระบบ", url: "/api/dashboard" },
          ]} /><div className="citizen-map-legend"><span>● สถานีระดับน้ำ</span><span>△ ประกาศเฝ้าระวัง / เตือนภัย</span><span>＋ ศูนย์อพยพยืนยันเปิดล่าสุด</span></div>{!confirmedShelters.length && <p>ยังไม่มีศูนย์ที่ยืนยันเปิดล่าสุด ติดต่อเจ้าหน้าที่พื้นที่หรือ ปภ. 1784</p>}{confirmedShelters.map((s) => <article className="citizen-shelter" key={s.id}><b>{s.name}</b><span>ความจุตามทะเบียน {s.capacity} คน · ยังไม่ใช่จำนวนที่ว่าง</span><small>ยืนยัน {new Date(s.updatedAt!).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small></article>)}</section>}
        {tab === "windy" && <WindyViewer onBack={() => navigate("home")} />}
        {tab === "forecast" && <ForecastMonitor onBack={() => navigate("home")} />}
        {tab === "water" && <WaterMonitor onBack={() => navigate("home")} />}
        {tab === "drought" && <DroughtMonitor />}
        {tab === "report" && <ReportForm user={user} />}
        {tab === "mine" && <ReportList user={user} />}
      </main>
      <footer className="citizen-footer">SMART BASIN · ข้อมูลเพื่อการติดตามสถานการณ์ลุ่มน้ำป่าพะยอม<a href="/privacy">ความเป็นส่วนตัว</a></footer>
    </div>
    <nav className="citizen-mobile-nav" aria-label="เมนูหลักบนมือถือ">{tabs.map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={21} /><span>{label === "เฝ้าระวังภัยแล้ง" ? "ภัยแล้ง" : label === "รายงานของฉัน" ? "รายงานฉัน" : label}</span></button>)}</nav>
  </div>;
}
