"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { canManageReports, passabilityLabels, waterDepthLabels, reportKinds, reportStatuses, type CitizenReport } from "@/lib/reports";
import type { AppUser } from "@/lib/auth";

export default function ReportList({ user }: { user: AppUser | null }) {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const manage = user && canManageReports(user);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/reports", { cache: "no-store" }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReports(data.reports);
    } catch (e) { setError(e instanceof Error ? e.message : "โหลดรายงานไม่ได้"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); } }, [user, load]);
  if (!user) return <div className="citizen-empty"><h2>ติดตามรายงานของคุณ</h2><p>เข้าสู่ระบบด้วยบัญชี LINE เดิมเพื่อดูสถานะและข้อความจากเจ้าหน้าที่</p><a className="citizen-primary" href="/api/auth/line/start?returnTo=%2F%23mine">เข้าสู่ระบบด้วย LINE</a></div>;

  async function update(id: string, status: string, note: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, note }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "เปลี่ยนสถานะไม่ได้"); } finally { setBusy(null); }
  }
  const transitions = { pending: ["verified", "rejected"], verified: ["in_progress", "resolved", "rejected"], in_progress: ["resolved"], resolved: [], rejected: [] } as const;
  return <section className="report-list">
    <div className="citizen-section-heading"><div><h2>{manage ? "รายงานจากประชาชน" : "รายงานของฉัน"}</h2><p>แสดง 100 รายการล่าสุด · ข้อมูลส่วนบุคคลไม่เผยแพร่ต่อสาธารณะ</p></div><button className="citizen-secondary" onClick={load} disabled={loading}><RefreshCw size={17} />โหลดใหม่</button></div>
    <label className="citizen-field">สถานะ<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">ทั้งหมด</option>{Object.entries(reportStatuses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    {error && <p className="citizen-error" role="alert">{error}</p>}
    {loading ? <p role="status">กำลังโหลดรายงาน…</p> : !error && !reports.filter((r) => filter === "all" || r.status === filter).length ? <div className="citizen-empty"><h3>ยังไม่มีรายงานในรายการนี้</h3><p>เมื่อส่งรายงานแล้ว คุณจะติดตามความคืบหน้าได้ที่นี่</p></div> : reports.filter((r) => filter === "all" || r.status === filter).map((r) => <article className="report-item" key={r.id}>
      <div className="report-item-top"><span className={`report-status status-${r.status}`}>{reportStatuses[r.status]}</span><small>{new Date(r.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small></div>
      <h3>{r.place}</h3><p>{reportKinds[r.kind]} · {passabilityLabels[r.passability]}</p>{r.waterDepth && <p>ระดับน้ำที่ผู้แจ้งสังเกต: {waterDepthLabels[r.waterDepth]}</p>}<p className="report-description">{r.description}</p>
      {r.peopleCount && <p>ต้องการความช่วยเหลือ {r.peopleCount} คน · {r.needs.join(", ")}</p>}
      <small>พบเหตุ {new Date(r.observedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small>
      <details><summary>ข้อมูลติดต่อ พิกัด และประวัติรายงาน</summary><p>{r.contactName} · <a href={`tel:${r.contactPhone}`}>{r.contactPhone}</a></p>{r.latitude !== null && <p>พิกัด {r.latitude}, {r.longitude}</p>}<small className="receipt-code">เลขรายงาน {r.id}</small>{r.photos?.length > 0 && <div className="report-saved-photos">{r.photos.map((photo, index) => <a key={photo.id} href={`/api/reports/${r.id}/photo?photoId=${photo.id}`} target="_blank" rel="noreferrer">
        {/* Private image requests must keep the user's session cookies. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/reports/${r.id}/photo?photoId=${photo.id}`} alt={`รูปประกอบที่ ${index + 1}: ${photo.filename}`} loading="lazy" /><span>รูปที่ {index + 1}</span></a>)}</div>}<ol className="report-timeline">{r.events.map((event, i) => <li key={i}><b>{reportStatuses[event.status]}</b><small>{new Date(event.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</small>{event.note && <p>{event.note}</p>}</li>)}</ol></details>
      {manage && transitions[r.status].length > 0 && <form className="staff-review" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void update(r.id, String(data.get("status")), String(data.get("note"))); }}><label className="citizen-field">เปลี่ยนสถานะ<select name="status">{transitions[r.status].map((status) => <option key={status} value={status}>{reportStatuses[status]}</option>)}</select></label><label className="citizen-field">บันทึกถึงผู้แจ้ง<textarea name="note" maxLength={1000} rows={2} placeholder="ระบุสิ่งที่ตรวจสอบหรือความคืบหน้า" /></label><button className="citizen-primary" disabled={busy !== null}>{busy === r.id ? "กำลังบันทึก…" : "บันทึกสถานะ"}</button></form>}
    </article>)}
  </section>;
}
