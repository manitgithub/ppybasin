"use client";
import L from "leaflet";
import { useEffect, useState } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { agoLabel, passabilityLabels, reportKinds, reportStatuses, waitLabel, waterDepthLabels, type CitizenReport } from "@/lib/reports";

// Citizen reports come from the access-controlled reports API: guests get nothing, citizens see only
// their own reports, staff see the queue. Contact details are never placed on the map.
const ACTIVE = new Set<CitizenReport["status"]>(["pending", "verified", "in_progress"]);

const svg = {
  help: `<circle cx="16" cy="16" r="14.5" fill="#12506f" stroke="#fff" stroke-width="2.5"/>
      <circle cx="16" cy="16" r="8" fill="none" stroke="#fff" stroke-width="3"/>
      <circle cx="16" cy="16" r="3.5" fill="#12506f"/>
      <path d="M16 8v4M16 20v4M8 16h4M20 16h4" stroke="#f2b632" stroke-width="3"/>`,
  flood: `<circle cx="16" cy="16" r="14.5" fill="#fff" stroke="#226da0" stroke-width="2.5"/>
      <path d="M16 6.5c3.6 4.4 5.6 7.6 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-2.5 2-5.7 5.6-10.1Z" fill="#226da0"/>
      <path d="M7 24.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" fill="none" stroke="#226da0" stroke-width="2" stroke-linecap="round"/>`,
  receded: `<circle cx="16" cy="16" r="14.5" fill="#257450" stroke="#fff" stroke-width="2.5"/>
      <path d="m9.5 16.5 4.2 4.2 8.8-9.2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
};
const theme = {
  help: { border: "#12506f", text: "#12506f" },
  flood: { border: "#226da0", text: "#1b557d" },
  receded: { border: "#257450", text: "#1f5f42" },
};
const shortTitle = (r: CitizenReport) => r.kind === "help" ? (r.status === "in_progress" ? "กำลังช่วยเหลือ" : "ขอความช่วยเหลือ") : r.kind === "receded" ? "แจ้งน้ำลด" : "แจ้งน้ำท่วม";

function timeText(r: CitizenReport, now: number) {
  if (r.kind === "help") return waitLabel(r.createdAt, now);
  return { text: agoLabel(r.createdAt, now), overdue: false };
}

function reportIcon(r: CitizenReport, now: number) {
  const t = theme[r.kind];
  const time = timeText(r, now);
  const detail = r.kind === "flood" ? passabilityLabels[r.passability] : "";
  const filled = time.overdue;
  return L.divIcon({
    className: "",
    html: `<div role="img" aria-label="${shortTitle(r)} · ${reportStatuses[r.status]} · ${time.text}" style="display:flex;width:max-content;align-items:center;gap:4px;transform:translate(-16px,-16px);white-space:nowrap">
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" style="flex:0 0 32px;max-width:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">${svg[r.kind]}</svg>
    <span style="display:flex;flex-direction:column;background:${filled ? t.border : "#fff"};color:${filled ? "#fff" : t.text};border:1px solid ${t.border};border-radius:4px;padding:1px 6px;font:700 11px/15px system-ui,sans-serif">${shortTitle(r)}${detail ? ` · ${detail}` : ""}<small style="font:${filled ? 700 : 500} 11px/15px system-ui,sans-serif">⏱ ${time.text}${r.status === "pending" ? " · รอตรวจสอบ" : ""}</small></span>
  </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const timeFormat = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

export default function CitizenReportLayer() {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/reports", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return; // Not signed in or no access: show nothing.
        const data = await response.json();
        if (Array.isArray(data.reports)) setReports(data.reports.filter((r: CitizenReport) => ACTIVE.has(r.status) && r.latitude !== null && r.longitude !== null));
      } catch { /* Keep the last known reports. */ }
    }
    void load(); const timer = setInterval(() => void load(), 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  return <>{reports.map((r) => <Marker key={r.id} position={[r.latitude!, r.longitude!]} icon={reportIcon(r, now)} title={`${shortTitle(r)} · ${r.place}`} zIndexOffset={r.kind === "help" ? 1500 : 1200}>
    <Tooltip>{shortTitle(r)} · {r.place} · {timeText(r, now).text}</Tooltip>
    <Popup>
      <b>{reportKinds[r.kind]} · {r.place}</b>
      <p>สถานะ: {reportStatuses[r.status]}{r.status === "pending" ? " (ยังไม่ยืนยัน)" : ""}{r.assignedName ? ` · ผู้รับเคส ${r.assignedName}` : ""}</p>
      {r.kind !== "help" && <p>{passabilityLabels[r.passability]}{r.waterDepth && r.waterDepth !== "unknown" ? ` · ระดับน้ำ${waterDepthLabels[r.waterDepth]}` : ""}</p>}
      {r.peopleCount ? <p>{r.peopleCount} คน · {r.needs.join(", ")}</p> : null}
      <p>{r.description}</p>
      <p>รับแจ้ง {timeFormat(r.createdAt)} · <b>{timeText(r, now).text}</b></p>
    </Popup>
  </Marker>)}</>;
}
