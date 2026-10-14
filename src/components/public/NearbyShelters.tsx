"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LocateFixed, MapPin, Navigation, RefreshCw } from "lucide-react";
import type { ShelterRecord } from "@/components/dashboard/types";
import { rankNearbyShelters, shelterMapsUrl, type GpsPosition } from "@/lib/nearby-shelters";
import DataSource from "@/components/DataSource";
import styles from "./NearbyShelters.module.css";

const statusLabels: Record<string, string> = { open: "เปิดตามทะเบียน", standby: "เตรียมพร้อม · ต้องยืนยันเปิด", full: "เต็มตามทะเบียน", closed: "ปิดตามทะเบียน" };

export default function NearbyShelters() {
  const [data, setData] = useState<{ loading: boolean; error: string; shelters: ShelterRecord[] }>({ loading: true, error: "", shelters: [] });
  const [refresh, setRefresh] = useState(0);
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shelters", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async (response) => {
        if (!response.ok) throw new Error("ยังอ่านทะเบียนศูนย์อพยพไม่ได้");
        const payload = await response.json();
        if (!payload.ok || !Array.isArray(payload.shelters)) throw new Error("ข้อมูลทะเบียนศูนย์อพยพไม่พร้อม");
        if (!controller.signal.aborted) setData({ loading: false, error: "", shelters: payload.shelters });
      })
      .catch(() => { if (!controller.signal.aborted) setData({ loading: false, error: "เชื่อมต่อทะเบียนศูนย์อพยพไม่ได้ กรุณาลองใหม่", shelters: [] }); });
    return () => controller.abort();
  }, [refresh]);

  function locate() {
    setGpsError("");
    if (!window.isSecureContext) { setGpsError("ต้องเปิดเว็บผ่าน HTTPS หรือ localhost เพื่อใช้ตำแหน่ง GPS"); return; }
    if (!navigator.geolocation) { setGpsError("เบราว์เซอร์นี้ไม่รองรับ GPS กรุณาเปิดด้วยเบราว์เซอร์ที่รองรับตำแหน่ง"); return; }
    setLocating(true);
    setPosition(null);
    const id = ++requestId.current;
    navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
      if (id !== requestId.current) return;
      setLocating(false);
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
        setGpsError("พิกัด GPS ไม่ถูกต้อง กรุณาลองรับตำแหน่งใหม่"); return;
      }
      setPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, timestamp });
    }, (error) => {
      if (id !== requestId.current) return;
      setLocating(false);
      setGpsError(error.code === 1 ? "ยังไม่ได้รับอนุญาตตำแหน่ง กรุณาอนุญาต GPS ในการตั้งค่าเบราว์เซอร์ แล้วลองใหม่"
        : error.code === 3 ? "รับตำแหน่งไม่ทันเวลา ลองอยู่ในพื้นที่เปิดแล้วกดอีกครั้ง" : "ยังรับตำแหน่ง GPS ไม่ได้ กรุณาเปิดบริการตำแหน่งแล้วลองใหม่");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  const ranked = useMemo(() => position ? rankNearbyShelters(data.shelters, position) : [], [data.shelters, position]);
  const open = ranked.filter((shelter) => shelter.status === "open");
  const other = ranked.filter((shelter) => shelter.status !== "open");

  function results(shelters: typeof ranked) {
    return <div className={styles.list}>{shelters.slice(0, 5).map((shelter) => <article key={shelter.id} className={styles.shelter}>
      <div className={styles.description}>
        <span className={shelter.status === "open" ? styles.open : styles.pending}>{statusLabels[shelter.status] ?? "ต้องตรวจสอบสถานะ"}</span>
        <h3><MapPin size={18} aria-hidden="true" />{shelter.name}</h3>
        <p>{shelter.code} · ระยะห่างเส้นตรง {shelter.distanceKm.toLocaleString("th-TH", { maximumFractionDigits: 2 })} กม.</p>
        <small>ความจุตามทะเบียน {shelter.capacity == null ? "ไม่ระบุ" : `${shelter.capacity.toLocaleString("th-TH")} คน`} · ไม่ใช่จำนวนที่ว่าง</small>
        <small>อัปเดตทะเบียน {Number.isFinite(Date.parse(shelter.updated_at)) ? new Date(shelter.updated_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "ไม่ทราบเวลา"}</small>
      </div>
      <a href={shelterMapsUrl(shelter, shelter.status === "open" ? position ?? undefined : undefined)} target="_blank" rel="noopener noreferrer" className={shelter.status === "open" ? styles.navigate : styles.view} aria-label={`${shelter.status === "open" ? "นำทางด้วย Google Maps ไปยัง" : "ดูตำแหน่ง"} ${shelter.name} (แท็บใหม่)`}>
        {shelter.status === "open" ? <Navigation size={17} /> : <ExternalLink size={17} />}{shelter.status === "open" ? "นำทางด้วย Google Maps" : "ดูตำแหน่ง"}
      </a>
    </article>)}</div>;
  }

  return <section className={styles.root}>
    <div className={styles.gps}>
      <div><h2><LocateFixed size={21} />ค้นหาจากตำแหน่ง GPS ของคุณ</h2><p>ใช้ตำแหน่งเพื่อเรียงศูนย์ป่าพะยอมใกล้คุณ ไม่ต้องเข้าสู่ระบบ</p></div>
      <button type="button" onClick={locate} disabled={locating}><LocateFixed size={18} />{locating ? "กำลังรับตำแหน่ง…" : position ? "รับตำแหน่งใหม่" : "ใช้ตำแหน่งปัจจุบัน"}</button>
    </div>
    <div aria-live="polite">
      {gpsError && <p className={styles.error} role="alert">{gpsError}</p>}
      {position && <p className={styles.position}>GPS: {position.lat.toFixed(6)}, {position.lng.toFixed(6)} · {Number.isFinite(position.accuracy) ? `ความแม่นยำประมาณ ±${Math.round(position.accuracy)} เมตร` : "ไม่ทราบความแม่นยำ"}</p>}
      {data.loading && <p role="status">กำลังอ่านทะเบียนศูนย์อพยพ…</p>}
      {data.error && <div className={styles.error}><p role="alert">{data.error}</p><button type="button" onClick={() => { setData({ loading: true, error: "", shelters: [] }); setRefresh((value) => value + 1); }}><RefreshCw size={16} />ลองเชื่อมต่อใหม่</button></div>}
    </div>
    {!position && !gpsError && <p className={styles.empty}>กด “ใช้ตำแหน่งปัจจุบัน” แล้วอนุญาตตำแหน่งในเบราว์เซอร์เพื่อดูศูนย์ใกล้คุณ</p>}
    {position && !data.loading && !data.error && <>
      <p className={styles.note}>เรียงตามระยะเส้นตรง ไม่ใช่ระยะทางถนน โปรดยืนยันการเปิดและที่ว่างกับเจ้าหน้าที่ก่อนเดินทาง เส้นทาง Google Maps ไม่ได้ยืนยันว่าปลอดภัยจากน้ำท่วม</p>
      <h2 className={styles.heading}>ศูนย์สถานะเปิดใกล้คุณ</h2>
      {open.length ? results(open) : <p className={styles.empty}>ยังไม่มีศูนย์สถานะเปิดที่มีพิกัดในทะเบียน ติดต่อ ปภ. <a href="tel:1784">1784</a> เพื่อยืนยันศูนย์ที่พร้อมรับ</p>}
      {other.length > 0 && <><h2 className={styles.heading}>ศูนย์อื่นใกล้คุณ · ต้องตรวจสอบความพร้อม</h2>{results(other)}</>}
      {!ranked.length && <p className={styles.empty}>ยังไม่มีศูนย์ป่าพะยอมที่มีพิกัดถูกต้องในทะเบียน</p>}
    </>}
    <div className={styles.source}><DataSource label="ทะเบียนศูนย์อพยพในฐานข้อมูล · เฉพาะ PPY-SH-XXX" url="/api/shelters" /><p>ตำแหน่ง GPS ใช้คำนวณในหน้านี้ เมื่อกดนำทางจะส่งตำแหน่งเริ่มต้นให้ Google Maps</p></div>
  </section>;
}
