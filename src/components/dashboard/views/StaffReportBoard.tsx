"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Clock3, Handshake, LifeBuoy, MapPin, Phone, RefreshCw, Search, XCircle } from "lucide-react";
import { DataSources } from "@/components/DataSource";
import type { AppUser } from "@/lib/auth";
import { canClaimReports, canManageReports, passabilityLabels, reportKinds, reportStatuses, waitLabel, waterDepthLabels, type CitizenReport } from "@/lib/reports";
import styles from "./ReportsWorkspace.module.css";

type Status = CitizenReport["status"];
type StatusFilter = "active" | "all" | Status;
type KindFilter = "all" | CitizenReport["kind"];

const ACTIVE: Status[] = ["pending", "verified", "in_progress"];
const ORDER: Status[] = ["pending", "verified", "in_progress", "resolved", "rejected"];
const transitions: Record<Status, Status[]> = { pending: ["verified", "rejected"], verified: ["in_progress", "resolved", "rejected"], in_progress: ["resolved"], resolved: [], rejected: [] };
const actionLabels: Record<Status, string> = { pending: "", verified: "ยืนยันเหตุ", in_progress: "เริ่มประสานช่วยเหลือ", resolved: "ปิดเหตุ", rejected: "ไม่รับรายงาน" };
const statusIcons: Record<Status, typeof Clock3> = { pending: Clock3, verified: CheckCircle2, in_progress: Handshake, resolved: CheckCircle2, rejected: XCircle };

const timeFormat = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

export default function StaffReportBoard({ user }: { user: AppUser }) {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => { const tick = () => setClock(Date.now()); const first = setTimeout(tick, 0); const timer = setInterval(tick, 30_000); return () => { clearTimeout(first); clearInterval(timer); }; }, []);
  const manage = canManageReports(user);
  const claim = canClaimReports(user);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReports(data.reports); setLoadedAt(Date.now());
    } catch (e) { setError(e instanceof Error && e.message ? e.message : "โหลดรายงานไม่ได้"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  async function update(report: CitizenReport, status: Status, note: string, action?: "claim") {
    setBusy(report.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: report.id, status, note, action }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setNotice(action === "claim" ? `รับเคส “${report.place}” แล้ว` : `บันทึกสถานะ “${reportStatuses[status]}” ให้ “${report.place}” แล้ว`);
      await load();
    } catch (e) { setError(e instanceof Error && e.message ? e.message : "เปลี่ยนสถานะไม่ได้"); } finally { setBusy(null); }
  }

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { active: 0, all: reports.length, pending: 0, verified: 0, in_progress: 0, resolved: 0, rejected: 0 };
    for (const r of reports) { result[r.status] += 1; if (ACTIVE.includes(r.status)) result.active += 1; }
    return result;
  }, [reports]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) => statusFilter === "all" || (statusFilter === "active" ? ACTIVE.includes(r.status) : r.status === statusFilter))
      .filter((r) => kindFilter === "all" || r.kind === kindFilter)
      .filter((r) => !q || [r.place, r.description, r.contactName, r.contactPhone, r.id].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || Number(b.kind === "help") - Number(a.kind === "help") || b.createdAt.localeCompare(a.createdAt));
  }, [reports, statusFilter, kindFilter, query]);

  const chips: { id: StatusFilter; label: string }[] = [
    { id: "active", label: "ต้องดำเนินการ" },
    ...ORDER.map((id) => ({ id, label: reportStatuses[id] })),
    { id: "all", label: "ทั้งหมด" },
  ];
  const now = clock ?? loadedAt ?? 0;

  return <section className={styles.workspace} aria-labelledby="staff-reports-title">
    <div className={styles.header}>
      <div>
        <h2 id="staff-reports-title">{manage ? "รายงานจากประชาชน" : "เคสช่วยเหลือ"}</h2>
        <p>{loadedAt ? `อัปเดตล่าสุด ${new Date(loadedAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} น.` : "กำลังโหลด…"} · 100 รายการล่าสุด · ข้อมูลติดต่อเห็นเฉพาะเจ้าหน้าที่</p>
      </div>
      <button type="button" className={styles.btn} onClick={() => void load()} disabled={loading}><RefreshCw size={17} aria-hidden />{loading ? "กำลังโหลด…" : "โหลดใหม่"}</button>
    </div>

    <div className={styles.chips} role="group" aria-label="กรองตามสถานะ">
      {chips.map((chip) => <button key={chip.id} type="button" aria-pressed={statusFilter === chip.id} className={`${styles.chip} ${statusFilter === chip.id ? styles.chipActive : ""}`} onClick={() => setStatusFilter(chip.id)}>{chip.label}<b>{counts[chip.id]}</b></button>)}
    </div>

    <div className={styles.toolbar}>
      <label className={styles.search}><span className="sr-only">ค้นหารายงาน</span><Search size={18} aria-hidden /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานที่ รายละเอียด ชื่อ หรือเบอร์โทร" /></label>
      <label><span className="sr-only">ประเภทรายงาน</span><select className={styles.select} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} style={{ width: "100%" }}><option value="all">ทุกประเภท</option>{Object.entries(reportKinds).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}

    {loading && !reports.length ? <p role="status">กำลังโหลดรายงาน…</p>
      : !reports.length && !error ? <div className={styles.empty}><h3>ยังไม่มีรายงานจากประชาชน</h3><p>รายงานใหม่จะแสดงที่นี่ กด “โหลดใหม่” เพื่อตรวจสอบอีกครั้ง</p></div>
      : !visible.length ? <div className={styles.empty}><h3>ไม่พบรายงานตามตัวกรองนี้</h3><p>ลองเลือก “ทั้งหมด” หรือล้างคำค้นหา</p></div>
      : <>
        <p className={styles.resultCount}>แสดง {visible.length} จาก {reports.length} รายการ · เรียงจากรอตรวจสอบ และเคสขอความช่วยเหลือก่อน</p>
        <div className={styles.list}>{visible.map((r) => <ReportCard key={r.id} report={r} user={user} manage={manage} claim={claim} busy={busy} now={now} onUpdate={update} />)}</div>
      </>}

    <DataSources sources={[{ label: "รายงานจากประชาชนและสถานะที่เจ้าหน้าที่บันทึก · เข้าถึงตามสิทธิ์ผู้ใช้งาน", url: "/api/reports" }]} />
  </section>;
}

function ReportCard({ report: r, user, manage, claim, busy, now, onUpdate }: {
  report: CitizenReport; user: AppUser; manage: boolean; claim: boolean; busy: string | null; now: number;
  onUpdate: (report: CitizenReport, status: Status, note: string, action?: "claim") => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [needNote, setNeedNote] = useState(false);
  const StatusIcon = statusIcons[r.status];
  const isHelp = r.kind === "help";
  const next = manage ? transitions[r.status] : [];
  const canClaim = claim && isHelp && !r.assignedTo && (r.status === "pending" || r.status === "verified");
  const saving = busy === r.id;

  function act(status: Status) {
    if (status === "rejected" && !note.trim()) { setNeedNote(true); return; }
    setNeedNote(false);
    void onUpdate(r, status, note).then(() => setNote(""));
  }

  return <article className={`${styles.card} ${isHelp ? styles.cardHelp : ""}`}>
    <div className={styles.cardTop}>
      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles[`status-${r.status}`]}`}><StatusIcon size={14} aria-hidden />{reportStatuses[r.status]}</span>
        <span className={`${styles.badge} ${isHelp ? styles.kindHelp : styles.kindBadge}`}>{isHelp ? <LifeBuoy size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />}{reportKinds[r.kind]}</span>
      </div>
      {(() => {
        const wait = now ? waitLabel(r.createdAt, now) : null;
        const waiting = ACTIVE.includes(r.status);
        return <span className={`${styles.time} ${wait?.overdue && waiting ? styles.overdue : ""}`} title={`รับแจ้ง ${timeFormat(r.createdAt)}`}><Clock3 size={13} aria-hidden />{wait && waiting ? wait.text : `รับแจ้ง ${timeFormat(r.createdAt)}`}</span>;
      })()}
    </div>

    <h3 className={styles.place}>{r.place}</h3>

    <dl className={styles.facts}>
      <div><dt>พบเหตุ</dt><dd>{timeFormat(r.observedAt)}</dd></div>
      <div><dt>สภาพการสัญจร</dt><dd>{passabilityLabels[r.passability]}</dd></div>
      {r.waterDepth && <div><dt>ระดับน้ำที่ผู้แจ้งเห็น</dt><dd>{waterDepthLabels[r.waterDepth]}</dd></div>}
      {r.peopleCount ? <div><dt>ผู้ต้องการช่วยเหลือ</dt><dd>{r.peopleCount} คน</dd></div> : null}
      {r.needs.length > 0 && <div><dt>ต้องการ</dt><dd>{r.needs.join(", ")}</dd></div>}
    </dl>

    {r.description && <p className={styles.description}>{r.description}</p>}

    <div className={styles.contact}>
      <span>ผู้แจ้ง <strong>{r.contactName || "ไม่ระบุชื่อ"}</strong></span>
      {r.contactPhone && <a className={styles.contactLink} href={`tel:${r.contactPhone}`}><Phone size={16} aria-hidden />{r.contactPhone}</a>}
      {r.latitude !== null && r.longitude !== null && <a className={styles.contactLink} href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer"><MapPin size={16} aria-hidden />เปิดพิกัดในแผนที่</a>}
    </div>

    {r.photos?.length > 0 && <div className={styles.photos}>{r.photos.map((photo, index) => <a key={photo.id} href={`/api/reports/${r.id}/photo?photoId=${photo.id}`} target="_blank" rel="noreferrer">
      {/* Private image requests must keep the user's session cookies. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/reports/${r.id}/photo?photoId=${photo.id}`} alt={`รูปประกอบที่ ${index + 1}: ${photo.filename}`} loading="lazy" />
    </a>)}</div>}

    {r.assignedTo && <p className={styles.assigned}>ผู้รับเคส: <strong>{r.assignedName ?? "อาสาสมัคร"}</strong>{r.assignedTo === user.id ? " (คุณ)" : ""}</p>}

    <details className={styles.history}>
      <summary>ประวัติการดำเนินการ ({r.events.length})</summary>
      <ol className={styles.timeline}>{r.events.map((event, i) => <li key={i}><b>{reportStatuses[event.status]}</b><small>{timeFormat(event.createdAt)}</small>{event.note && <p>{event.note}</p>}</li>)}</ol>
      <p className={styles.receipt}>เลขรายงาน {r.id}</p>
    </details>

    {(next.length > 0 || canClaim) && <div className={styles.actions}>
      {next.length > 0 && <label><span className="sr-only">บันทึกถึงผู้แจ้ง</span><textarea value={note} onChange={(e) => { setNote(e.target.value); if (e.target.value.trim()) setNeedNote(false); }} maxLength={1000} placeholder="บันทึกถึงผู้แจ้ง เช่น สิ่งที่ตรวจสอบหรือความคืบหน้า (ต้องระบุเมื่อไม่รับรายงาน)" aria-invalid={needNote} /></label>}
      {needNote && <p className={styles.error} role="alert">กรุณาระบุเหตุผลที่ไม่รับรายงาน เพื่อแจ้งให้ผู้แจ้งทราบ</p>}
      <div className={styles.actionButtons}>
        {canClaim && <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy !== null} onClick={() => void onUpdate(r, "in_progress", "", "claim")}><Handshake size={17} aria-hidden />{saving ? "กำลังรับเคส…" : "รับเคสช่วยเหลือ"}</button>}
        {next.map((status, index) => <button key={status} type="button" disabled={busy !== null} onClick={() => act(status)}
          className={`${styles.btn} ${status === "rejected" ? styles.btnQuiet : status === "resolved" ? styles.btnSafe : index === 0 ? styles.btnPrimary : ""}`}>
          {status === "rejected" ? <XCircle size={17} aria-hidden /> : status === "in_progress" ? <Handshake size={17} aria-hidden /> : <CheckCircle2 size={17} aria-hidden />}
          {saving ? "กำลังบันทึก…" : actionLabels[status]}
        </button>)}
      </div>
    </div>}
  </article>;
}
