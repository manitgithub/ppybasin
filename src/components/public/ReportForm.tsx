"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Accessibility, Ambulance, ArrowDown, Ban, Car, CheckCircle2, ChevronLeft, CircleHelp, HandHeart, LocateFixed, LogIn, MoreHorizontal, Navigation, Pill, Send, ShieldCheck, Sun, Utensils, Waves } from "lucide-react";
import ReportPhotoPicker from "./ReportPhotoPicker";
import { OptionButton, WaterDepthOptions } from "./ReportOptions";
import type { ReportLocation } from "./ReportLocationPicker";
import type { AppUser } from "@/lib/auth";
import { assistanceNeeds, canCreateReports, passabilityLabels, reportKinds, waterDepthLabels } from "@/lib/reports";

const ReportLocationPicker = dynamic(() => import("./ReportLocationPicker"), { ssr: false, loading: () => <div className="report-location-loading">กำลังเปิดแผนที่เลือกจุดเกิดเหตุ…</div> });
const kindIcons = { flood: Waves, help: HandHeart, receded: ArrowDown };
const roadIcons = { unknown: CircleHelp, passable: Car, small_blocked: Car, blocked: Ban, dry: Sun };
const needIcons = [Navigation, Utensils, Pill, Accessibility, MoreHorizontal];

function localNow() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function ReportForm({ user, onSent }: { user: AppUser | null; onSent?: () => void }) {
  const [kind, setKind] = useState<keyof typeof reportKinds>("flood");
  const [step, setStep] = useState(1);
  const [waterDepth, setWaterDepth] = useState<keyof typeof waterDepthLabels>("unknown");
  const [passability, setPassability] = useState<keyof typeof passabilityLabels>("unknown");
  const [needs, setNeeds] = useState<string[]>([]);
  const [location, setLocation] = useState<ReportLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const submissionKey = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ppy-report-draft");
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (Date.now() - draft.savedAt > 30 * 60_000) { sessionStorage.removeItem("ppy-report-draft"); return; }
      const form = formRef.current;
      if (!form || !Object.hasOwn(reportKinds, draft.kind)) return;
      const timer = setTimeout(() => {
        setKind(draft.kind); setLocation(draft.location ?? null); setStep(1);
        const depth = draft.fields.waterDepth?.[0];
        if (depth && Object.hasOwn(waterDepthLabels, depth)) setWaterDepth(depth);
        const road = draft.fields.passability?.[0];
        if (road && Object.hasOwn(passabilityLabels, road)) setPassability(road);
        setNeeds((draft.fields.needs ?? []).filter((need: string) => assistanceNeeds.includes(need)));
        requestAnimationFrame(() => {
        for (const field of form.elements) {
          if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) continue;
          if (field.type === "file" || field.type === "radio") continue;
          if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = draft.fields[field.name]?.includes(field.value) ?? false;
          else if (draft.fields[field.name]?.[0]) field.value = draft.fields[field.name][0];
        }
        if (draft.hadPhoto) setError("ข้อมูลแบบฟอร์มยังอยู่ กรุณาแนบรูปเดิมอีกครั้งก่อนส่ง");
        sessionStorage.removeItem("ppy-report-draft");
        });
      }, 0);
      return () => clearTimeout(timer);
    } catch { sessionStorage.removeItem("ppy-report-draft"); }
  }, [user]);

  function locate() {
    if (!navigator.geolocation) { setLocationError("อุปกรณ์นี้ไม่รองรับ GPS ระบุชื่อสถานที่และจุดสังเกตแทนได้"); return; }
    setLocating(true); setLocationError("");
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }); setLocating(false);
    }, () => { setLocationError("อ่านตำแหน่งไม่ได้ ระบุชื่อหมู่บ้านและจุดสังเกตแทนได้"); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !user) return;
    setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    photos.forEach((file) => data.append("photos", file));
    submissionKey.current ??= crypto.randomUUID();
    data.set("submissionKey", submissionKey.current);
    data.set("observedAt", new Date(String(data.get("observedAt"))).toISOString());
    if (location) { data.set("latitude", String(location.lat)); data.set("longitude", String(location.lng)); }
    try {
      const response = await fetch("/api/reports", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "ส่งรายงานไม่สำเร็จ");
      setReceipt(payload.id); onSent?.();
    } catch (e) { setError(e instanceof Error ? e.message : "เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง"); } finally { setBusy(false); }
  }

  if (!user) return <section className="report-line-gate">
    <span className="report-line-icon"><LogIn size={27} /></span>
    <h2>เข้าสู่ระบบ LINE ก่อนแจ้งเหตุ</h2>
    <p>ใช้บัญชี LINE เพื่อส่งรายงานและติดตามความคืบหน้าจากเจ้าหน้าที่</p>
    <a className="report-line-login" href="/api/auth/line/start?returnTo=%2F%23report"><LogIn size={20} />เข้าสู่ระบบด้วย LINE</a>
    <small><ShieldCheck size={15} />บัญชีใหม่เป็นผู้ติดตามสถานการณ์</small>
    <div className="report-line-emergency"><Ambulance size={20} /><span>หากเกิดอันตรายเร่งด่วน ติดต่อหน่วยงานโดยตรง</span><a href="tel:1784">โทร ปภ. 1784</a></div>
  </section>;

  if (receipt) return <section className="citizen-receipt" role="status">
    <CheckCircle2 size={44} />
    <h2>รับรายงานของคุณแล้ว</h2><p>สถานะ: รอตรวจสอบ · ยังไม่ได้ยืนยันว่าเจ้าหน้าที่เริ่มช่วยเหลือ</p>
    <p className="receipt-code">เลขรายงาน <strong>{receipt}</strong></p><p>ดูความคืบหน้าได้ที่ “รายงานของฉัน”</p>
    <button className="citizen-primary" onClick={() => { setReceipt(""); setStep(1); setLocation(null); setWaterDepth("unknown"); setPassability("unknown"); setNeeds([]); setPhotos([]); submissionKey.current = null; }}>แจ้งอีกเหตุการณ์</button>
  </section>;

  return <div className="report-layout">
    <div>
      <div className="report-steps" aria-label={`ขั้นตอน ${step} จาก 2`}><span className={step === 1 ? "current" : "complete"}>1 <b>ข้อมูลเหตุการณ์</b></span><span className={step === 2 ? "current" : ""}>2 <b>ติดต่อและส่งรายงาน</b></span></div>
      <form ref={formRef} className="citizen-form" onSubmit={submit}>
        <fieldset hidden={step !== 1}>
          <legend>เกิดอะไรขึ้นในพื้นที่ของคุณ?</legend>
          <div className="report-kind-options">{Object.entries(reportKinds).map(([id, label]) => <OptionButton key={id} name="kind" value={id} label={label} icon={kindIcons[id as keyof typeof kindIcons]} selected={kind === id} onChange={() => { setKind(id as keyof typeof reportKinds); if (id === "receded") setWaterDepth("dry"); }} />)}</div>
          <WaterDepthOptions value={waterDepth} onChange={setWaterDepth} />
          <label className="citizen-field">สถานที่ / หมู่บ้าน <span className="field-hint">ระบุจุดสังเกตให้เจ้าหน้าที่หาเจอ</span><input name="place" required minLength={3} maxLength={150} placeholder="เช่น สะพานหน้าวัด หมู่ 2 ตำบลป่าพะยอม" autoComplete="off" /></label>
          <div className="gps-row"><button type="button" className="citizen-secondary" disabled={locating} onClick={locate}><LocateFixed size={18} />{locating ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}</button><small>กดเมื่อคุณอยู่บริเวณที่เกิดเหตุ</small></div>
          <ReportLocationPicker location={location} onChange={setLocation} />
          {location && <div className="gps-result" role="status">เลือกจุดเกิดเหตุแล้ว {location.lat.toFixed(5)}, {location.lng.toFixed(5)} {location.accuracy !== undefined && <small>GPS คลาดเคลื่อนประมาณ {Math.round(location.accuracy)} ม.</small>}<button type="button" onClick={() => setLocation(null)}>ลบพิกัด</button></div>}
          {!location && <p className="field-hint report-no-pin">ยังไม่ได้เลือกหมุด แตะแผนที่หรือลากหมุดเพื่อยืนยันจุดเกิดเหตุ</p>}
          {locationError && <p className="citizen-error" role="status">{locationError}</p>}
          <label className="citizen-field">พบเหตุเมื่อ<input type="datetime-local" name="observedAt" required defaultValue={localNow()} max={localNow()} /></label>
          <fieldset className="report-choice-field"><legend>สภาพการเดินทาง</legend><div className="report-choice-grid">{Object.entries(passabilityLabels).map(([id, label]) => <OptionButton key={id} name="passability" value={id} label={label} icon={roadIcons[id as keyof typeof roadIcons]} selected={passability === id} onChange={() => setPassability(id as keyof typeof passabilityLabels)} />)}</div></fieldset>
          <label className="citizen-field">รายละเอียดเหตุการณ์<textarea name="description" rows={4} required minLength={5} maxLength={2000} placeholder="ระดับน้ำ จุดที่ได้รับผลกระทบ หรือจุดสังเกตที่ช่วยให้เข้าถึงพื้นที่" /></label>
          {kind === "help" && <div className="assistance-fields"><label className="citizen-field">จำนวนผู้ต้องการความช่วยเหลือ<input name="peopleCount" type="number" inputMode="numeric" min={1} max={10000} required /></label><fieldset className="report-choice-field"><legend>ต้องการความช่วยเหลือเรื่องใด?</legend><div className="report-choice-grid">{assistanceNeeds.map((need, index) => <OptionButton key={need} name="needs" value={need} label={need} icon={needIcons[index]} selected={needs.includes(need)} multiple onChange={() => setNeeds((current) => current.includes(need) ? current.filter((value) => value !== need) : [...current, need])} />)}</div></fieldset></div>}
          <ReportPhotoPicker onChange={setPhotos} />
          <button type="button" className="citizen-primary" onClick={() => {
            const fields = formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("fieldset:not([hidden]) input, fieldset:not([hidden]) textarea, fieldset:not([hidden]) select");
            for (const field of fields ?? []) { if (!field.reportValidity()) return; }
            if (kind === "help" && !formRef.current?.querySelector('input[name="needs"]:checked')) { setError("เลือกสิ่งที่ต้องการความช่วยเหลืออย่างน้อย 1 รายการ"); return; }
            setError(""); setStep(2);
          }}>ถัดไป: ข้อมูลติดต่อ <Send size={17} /></button>
        </fieldset>
        <fieldset hidden={step !== 2}>
          <legend>ให้เจ้าหน้าที่ติดต่อคุณได้</legend>
          <p className="form-intro">ข้อมูลติดต่อใช้เพื่อประสานงานรายงานนี้ เจ้าหน้าที่ที่มีสิทธิ์และคุณเท่านั้นที่ดูได้</p>
          <label className="citizen-field">ชื่อผู้ติดต่อ<input name="contactName" required maxLength={100} autoComplete="name" defaultValue={user?.displayName ?? ""} /></label>
          <label className="citizen-field">เบอร์โทรศัพท์<input name="contactPhone" type="tel" inputMode="tel" required pattern="0[0-9 -]{8,14}" maxLength={15} autoComplete="tel" placeholder="08x xxx xxxx" /></label>
          <div className="report-summary"><b>ตรวจสอบก่อนส่ง</b><p>แนบรูปประกอบ {photos.length} รูป</p><p>{reportKinds[kind]} · ระดับน้ำ: {waterDepthLabels[waterDepth]}</p><p>{location ? `พิกัด ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "ไม่ได้ระบุพิกัด ใช้ชื่อสถานที่และจุดสังเกต"}</p><p>รายงานจะเริ่มที่สถานะ “รอตรวจสอบ” การส่งแบบฟอร์มไม่ได้ยืนยันการรับภารกิจของหน่วยกู้ภัย</p></div>
          {!canCreateReports(user) ? <p className="citizen-error">บัญชีนี้ไม่มีสิทธิ์ส่งรายงาน กรุณาติดต่อผู้ดูแลระบบ</p> : <button className="citizen-primary" type="submit" disabled={busy}><Send size={18} />{busy ? "กำลังส่งรายงาน…" : "ส่งรายงาน"}</button>}
          <button type="button" className="citizen-back" disabled={busy} onClick={() => setStep(1)}><ChevronLeft size={18} />กลับไปแก้ไขข้อมูลเหตุการณ์</button>
        </fieldset>
        {error && <p className="citizen-error" role="alert">{error}</p>}
      </form>
    </div>
    <aside className="report-guidance"><ShieldCheck size={22} /><h3>ข้อมูลจากคุณช่วยให้เห็นสถานการณ์</h3><p>บอกเฉพาะสิ่งที่เห็น พร้อมเวลาและสถานที่ รายงานทุกฉบับต้องตรวจสอบก่อนใช้ยืนยันสถานการณ์</p><ol><li>ส่งข้อมูลเหตุการณ์</li><li>เจ้าหน้าที่ตรวจสอบและประสานงาน</li><li>ติดตามความคืบหน้าในรายงานของฉัน</li></ol><p>หากเกิดอันตรายเร่งด่วน ให้โทรติดต่อหน่วยงานโดยตรง</p><a href="tel:1784">โทร ปภ. 1784</a></aside>
  </div>;
}
