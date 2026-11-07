"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, FilePlus2, Route } from "lucide-react";
import type { AppUser } from "@/lib/auth";
import { canClaimReports, canCreateReports, canManageReports, canManageRoads } from "@/lib/reports";
import ReportForm from "@/components/public/ReportForm";
import ReportList from "@/components/public/ReportList";
import RoadClosureManager from "@/components/public/RoadClosureManager";
import StaffReportBoard from "./StaffReportBoard";
import styles from "./ReportsWorkspace.module.css";

type Tab = "reports" | "roads" | "submit";

export default function ReportsWorkspace({ user }: { user: AppUser }) {
  const staff = canManageReports(user) || canClaimReports(user);
  const tabs = [
    { id: "reports" as const, label: staff ? "รายงานจากประชาชน" : "รายงานของฉัน", icon: ClipboardList, show: true },
    { id: "roads" as const, label: "ปิดถนน", icon: Route, show: canManageRoads(user) },
    { id: "submit" as const, label: "ส่งรายงานภาคสนาม", icon: FilePlus2, show: canCreateReports(user) },
  ].filter((tab) => tab.show);
  const [active, setActive] = useState<Tab>("reports");
  const [roadCount, setRoadCount] = useState<number | null>(null);
  const onRoadCount = useCallback((count: number) => setRoadCount(count), []);
  const canRoads = canManageRoads(user);
  useEffect(() => {
    if (!canRoads) return;
    const controller = new AbortController();
    fetch("/api/road-closures", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data) => { if (Array.isArray(data.closures)) setRoadCount(data.closures.length); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [canRoads]);

  return <div className={styles.workspace}>
    {tabs.length > 1 && <div className={styles.tabs} role="tablist" aria-label="งานรายงาน">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`reports-tab-${id}`} aria-selected={active === id} aria-controls={`reports-panel-${id}`}
        className={`${styles.tab} ${active === id ? styles.tabActive : ""}`} onClick={() => setActive(id)}>
        <Icon size={18} aria-hidden />{label}{id === "roads" && roadCount !== null && <span className={styles.tabCount} aria-label={`${roadCount} ช่วงที่ปิด`}>{roadCount}</span>}
      </button>)}
    </div>}
    <div role="tabpanel" id={`reports-panel-${active}`} aria-labelledby={`reports-tab-${active}`}>
      {active === "reports" && (staff ? <StaffReportBoard user={user} /> : <ReportList user={user} />)}
      {active === "roads" && <RoadClosureManager user={user} onCount={onRoadCount} />}
      {active === "submit" && <ReportForm user={user} />}
    </div>
  </div>;
}
