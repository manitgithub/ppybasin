"use client";

import { AlertTriangle, ChevronDown, CircleUser, Clock3, LogOut, Menu, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppUser } from "@/lib/auth";
import type { DashboardPayload } from "@/lib/dashboard-data";
import { navItems } from "@/components/dashboard/nav";
import { canAccessView, firstAllowedView } from "@/components/dashboard/permissions";
import type { ViewId } from "@/components/dashboard/types";
import { roleLabel } from "@/components/dashboard/utils";
import AccessDeniedView from "@/components/dashboard/views/AccessDeniedView";
import DashboardHome from "@/components/dashboard/views/DashboardHome";
import DataWarehouseCategoryView from "@/components/dashboard/views/DataWarehouseCategoryView";
import LoginScreen from "@/components/dashboard/views/LoginScreen";
import OperationalView from "@/components/dashboard/views/OperationalView";
import SensorDataView from "@/components/dashboard/views/SensorDataView";
import SensorDeviceManager from "@/components/dashboard/views/SensorDeviceManager";
import UserAccessManager from "@/components/dashboard/views/UserAccessManager";

type DashboardShellProps = {
  initialData: DashboardPayload;
  initialUser: AppUser | null;
};

const operationalViews = new Set<ViewId>([
  "tracking",
  "forecast",
  "risk",
  "evacuation-map",
  "shelters",
  "settings",
]);

function DashboardContent({
  activeView,
  data,
  currentUser,
  openShelters,
}: {
  activeView: ViewId;
  data: DashboardPayload;
  currentUser: AppUser;
  openShelters: number;
}) {
  if (!canAccessView(currentUser, activeView)) {
    return <AccessDeniedView viewId={activeView} />;
  }

  if (activeView === "sensors") {
    return <SensorDataView />;
  }

  if (activeView === "sensor-devices") {
    return <SensorDeviceManager />;
  }

  if (activeView === "village-basics" || activeView === "announcements") {
    return <DataWarehouseCategoryView viewId={activeView} data={data} />;
  }

  if (activeView === "users") {
    return <UserAccessManager currentUser={currentUser} />;
  }

  if (operationalViews.has(activeView)) {
    return <OperationalView viewId={activeView as Parameters<typeof OperationalView>[0]["viewId"]} data={data} />;
  }

  return <DashboardHome data={data} openShelters={openShelters} />;
}

export default function DashboardShell({ initialData, initialUser }: DashboardShellProps) {
  const [data, setData] = useState(initialData);
  const [currentUser] = useState(initialUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>(() => {
    return initialUser ? firstAllowedView(initialUser, navItems.map((item) => item.id)) : "dashboard";
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/dashboard", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: DashboardPayload) => setData(payload))
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const visibleNavItems = useMemo(() => {
    if (!currentUser) return [];
    return navItems
      .map((item) => {
        const children = item.children?.filter((child) => canAccessView(currentUser, child.id));
        return { ...item, children };
      })
      .filter((item) => canAccessView(currentUser, item.id) || Boolean(item.children?.length));
  }, [currentUser]);

  const openShelters = useMemo(
    () => data.shelters.filter((shelter) => shelter.status === "open").length,
    [data.shelters],
  );

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] text-slate-900">
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-[214px] flex-col bg-[#061b2e] text-slate-200 shadow-2xl transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <nav className="flex-1 space-y-2 px-2 py-5">
          <div className="space-y-1">
            {visibleNavItems.map((item) =>
              item.children?.length ? (
                <div key={item.label} className="space-y-1">
                  <div className="flex h-10 w-full items-center gap-3 rounded-[7px] px-3 text-[13px] font-extrabold text-slate-200">
                    <item.icon size={17} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </div>
                  <div className="space-y-1 border-l border-white/10 pl-4">
                    {item.children.map((child) => (
                      <button
                        key={child.label}
                        onClick={() => {
                          setActiveView(child.id);
                          setSidebarOpen(false);
                        }}
                        className={[
                          "flex h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-[12px] font-extrabold transition",
                          child.id === activeView
                            ? "bg-[#0f80e8] text-white shadow-lg shadow-blue-950/25"
                            : "text-slate-300 hover:bg-white/10 hover:text-white",
                        ].join(" ")}
                      >
                        <child.icon size={15} />
                        <span className="truncate">{child.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  key={item.label}
                  onClick={() => {
                    setActiveView(item.id);
                    setSidebarOpen(false);
                  }}
                  className={[
                    "flex h-11 w-full items-center gap-3 rounded-[7px] px-3 text-left text-[13px] font-extrabold transition",
                    item.id === activeView
                      ? "bg-[#0f80e8] text-white shadow-lg shadow-blue-950/25"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <item.icon size={17} />
                  <span className="truncate">{item.label}</span>
                </button>
              ),
            )}
          </div>
        </nav>
        <div className="m-3 rounded-[8px] bg-[#092844] p-3">
          <p className="mb-3 text-xs font-extrabold text-white">ระดับผู้ใช้งานในระบบ</p>
          <button className="mb-6 flex w-full items-center gap-2 rounded-[7px] bg-[#0d3b63] px-2 py-2 text-left">
            <span className="grid size-8 place-items-center rounded-[6px] bg-[#1487e8] text-white">
              <CircleUser size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-white">{roleLabel(currentUser.role)}</span>
            <ChevronDown size={14} />
          </button>
          <div className="mb-7 text-center">
            <p className="truncate text-sm font-extrabold text-white">{currentUser.displayName}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-300">{roleLabel(currentUser.role)}</p>
          </div>
          <button
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[7px] border border-white/15 bg-white/5 text-xs font-extrabold text-white"
            onClick={() => window.location.assign("/api/auth/logout")}
          >
            <LogOut size={16} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-[214px]">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 bg-[#061b2e] px-4 text-white shadow-lg shadow-slate-950/10 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="เปิดเมนู"
              className="grid size-10 place-items-center rounded-[8px] border border-white/15 bg-white/10 text-white lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-white bg-[#eef7ff] text-[#1267b9]">
              <Waves size={30} strokeWidth={2.7} />
            </div>
            <h1 className="max-w-[690px] text-[18px] font-extrabold leading-snug md:text-[21px]">
              ระบบอัจฉริยะติดตาม เฝ้าระวัง และคาดการณ์น้ำแล้ง-น้ำท่วม ลุ่มน้ำป่าพะยอม เพื่อเสริมสร้างความมั่นคงน้ำด้วยกลไกการมีส่วนร่วม
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            <button className="hidden h-14 items-center gap-3 rounded-[8px] bg-[#dc2b24] px-5 text-left shadow-lg shadow-red-950/20 xl:flex">
              <AlertTriangle size={31} fill="white" className="text-white" />
              <span>
                <span className="block text-sm font-extrabold">แจ้งเตือนวิกฤต</span>
                <span className="block text-xs font-bold">ระดับความเสี่ยง : สูงมาก</span>
              </span>
            </button>
            <div className="hidden h-14 items-center gap-3 border-l border-white/18 pl-5 md:flex">
              <Clock3 size={32} />
              <span>
                <span className="block text-lg font-extrabold leading-none">10:30:45</span>
                <span className="mt-1 block text-xs font-bold text-white/80">20 พ.ค. 2567</span>
              </span>
            </div>
            <button className="hidden h-14 items-center gap-3 border-l border-white/18 pl-5 md:flex">
              <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500">
                <CircleUser size={26} />
              </span>
              <span className="text-sm font-extrabold">{currentUser.displayName}</span>
              <ChevronDown size={14} className="text-white/70" />
            </button>
          </div>
        </header>

        <main className="p-3">
          <DashboardContent activeView={activeView} data={data} currentUser={currentUser} openShelters={openShelters} />
        </main>
      </div>
    </div>
  );
}
