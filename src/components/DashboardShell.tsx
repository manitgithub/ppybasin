"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  BatteryMedium,
  Bell,
  Bot,
  ChartNoAxesCombined,
  ChevronDown,
  Clock3,
  CloudRain,
  Database,
  Droplets,
  FileChartColumn,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Map,
  MapPinned,
  Menu,
  Radio,
  Settings,
  ShieldAlert,
  Siren,
  TestTubeDiagonal,
  Thermometer,
  Users,
  Waves,
  Wifi,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardPayload } from "@/lib/dashboard-data";

const BasinMap = dynamic(() => import("@/components/BasinMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">กำลังโหลดแผนที่...</div>,
});

type DashboardShellProps = {
  initialData: DashboardPayload;
};

type ViewId = "dashboard" | "sensors";

type SensorReading = {
  id: string;
  device_id: string;
  temperature: string | number;
  humidity: string | number;
  wind_speed: string | number;
  battery: string | number;
  recorded_at: string;
  received_at: string;
};

const navSections = [
  {
    label: "เมนูหลัก",
    items: [
      { id: "dashboard", label: "Dashboard สรุปผล", icon: LayoutDashboard },
      { label: "แผนที่ระบบน้ำ", icon: Map },
      { label: "สถานีตรวจวัดน้ำ", icon: Radio },
    ],
  },
  {
    label: "ข้อมูลการตรวจวัด",
    items: [
      { label: "ข้อมูลระดับน้ำ", icon: Droplets },
      { id: "sensors", label: "ข้อมูลเซ็นเซอร์ IoT (สด)", icon: Activity },
    ],
  },
  {
    label: "การพยากรณ์และเตือนภัย",
    items: [
      { label: "ระบบแจ้งเตือนภัย", icon: ShieldAlert },
      { label: "ผลการคาดการณ์ AI", icon: Bot },
      { label: "รายงานแจ้งจากชุมชน", icon: FileChartColumn },
    ],
  },
  {
    label: "การตั้งค่าระบบ",
    items: [
      { label: "รายงานสรุปสำหรับผู้บริหาร", icon: ChartNoAxesCombined },
      { label: "ตั้งค่าการเตือนภัยน้ำ", icon: Settings },
      { label: "จัดการผู้ใช้งานและสิทธิ์", icon: Users },
    ],
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function sensorAgeLabel(value?: string) {
  if (!value) {
    return "ยังไม่มีข้อมูล";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "เมื่อสักครู่";
  if (diffMinutes < 60) return `${diffMinutes.toLocaleString("th-TH")} นาทีที่แล้ว`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours.toLocaleString("th-TH")} ชั่วโมงที่แล้ว`;

  return `${Math.floor(diffHours / 24).toLocaleString("th-TH")} วันที่แล้ว`;
}

function SensorDataView() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const loadReadings = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/sensor", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "โหลดข้อมูลเซ็นเซอร์ไม่สำเร็จ");
      }

      setReadings(payload.readings ?? []);
      setLastRefresh(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลเซ็นเซอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadReadings(), 0);
    const timer = window.setInterval(() => void loadReadings(), 15_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [loadReadings]);

  const latest = readings[0];
  const uniqueDevices = new Set(readings.map((reading) => reading.device_id)).size;
  const averageBattery = readings.length
    ? readings.reduce((sum, reading) => sum + toNumber(reading.battery), 0) / readings.length
    : 0;

  const metrics = [
    {
      label: "อุปกรณ์ที่ส่งข้อมูล",
      value: uniqueDevices.toLocaleString("th-TH"),
      detail: readings.length ? `จาก readings ล่าสุด ${readings.length.toLocaleString("th-TH")} รายการ` : "รอข้อมูลจาก endpoint",
      icon: Wifi,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "อุณหภูมิล่าสุด",
      value: latest ? `${toNumber(latest.temperature).toFixed(1)}°C` : "-",
      detail: latest ? latest.device_id : "ยังไม่มีข้อมูล",
      icon: Thermometer,
      color: "text-rose-700",
      bg: "bg-rose-50",
    },
    {
      label: "ความชื้นล่าสุด",
      value: latest ? `${toNumber(latest.humidity).toFixed(0)}%` : "-",
      detail: latest ? sensorAgeLabel(latest.recorded_at) : "ยังไม่มีข้อมูล",
      icon: Droplets,
      color: "text-cyan-700",
      bg: "bg-cyan-50",
    },
    {
      label: "แบตเตอรี่เฉลี่ย",
      value: readings.length ? `${averageBattery.toFixed(2)}V` : "-",
      detail: "คำนวณจากรายการที่โหลดล่าสุด",
      icon: BatteryMedium,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 md:text-3xl">ข้อมูลเซ็นเซอร์ IoT (สด)</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            ตรวจ readings ล่าสุดจาก webhook `POST /api/sensor` พร้อมสถานะเวลาและค่าหลักของอุปกรณ์ภาคสนาม
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
            รีเฟรชล่าสุด: {lastRefresh ? formatDate(lastRefresh) : "กำลังโหลด"}
          </span>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0879df] px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-[#076bc5] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void loadReadings();
            }}
          >
            <Activity size={17} />
            รีเฟรช
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold text-slate-500">{metric.label}</p>
                <p className="mt-3 text-3xl font-extrabold tracking-normal text-slate-800">{metric.value}</p>
              </div>
              <span className={`grid size-11 place-items-center rounded-[8px] ${metric.bg} ${metric.color}`}>
                <metric.icon size={21} />
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500">{metric.detail}</p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-[8px] bg-slate-900 text-white">
              <Database size={19} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">รายการข้อมูลที่รับเข้าล่าสุด</h3>
              <p className="text-xs font-medium text-slate-500">เรียงตามเวลาที่อุปกรณ์บันทึก แล้วตามเวลาที่ระบบรับข้อมูล</p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">
            {loading ? "กำลังโหลด..." : `${readings.length.toLocaleString("th-TH")} รายการ`}
          </span>
        </div>

        {readings.length === 0 && !loading ? (
          <div className="grid min-h-[300px] place-items-center px-5 py-12 text-center">
            <div>
              <div className="mx-auto grid size-14 place-items-center rounded-[8px] bg-blue-50 text-blue-700">
                <Wifi size={25} />
              </div>
              <h4 className="mt-4 text-lg font-extrabold text-slate-800">ยังไม่มีข้อมูลเซ็นเซอร์</h4>
              <p className="mt-1 text-sm font-medium text-slate-500">ลองยิง POST มาที่ `/api/sensor` ด้วย payload ตัวอย่างใน README</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Device</th>
                  <th className="px-5 py-3">Temperature</th>
                  <th className="px-5 py-3">Humidity</th>
                  <th className="px-5 py-3">Wind</th>
                  <th className="px-5 py-3">Battery</th>
                  <th className="px-5 py-3">Recorded</th>
                  <th className="px-5 py-3">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {readings.map((reading) => (
                  <tr key={reading.id} className="hover:bg-blue-50/45">
                    <td className="px-5 py-4">
                      <span className="rounded-[8px] bg-slate-900 px-2.5 py-1 text-xs font-extrabold text-white">{reading.device_id}</span>
                    </td>
                    <td className="px-5 py-4 font-extrabold text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <Thermometer size={16} className="text-rose-500" />
                        {toNumber(reading.temperature).toFixed(1)}°C
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-700">{toNumber(reading.humidity).toFixed(0)}%</td>
                    <td className="px-5 py-4 font-bold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <Wind size={16} className="text-sky-500" />
                        {toNumber(reading.wind_speed).toFixed(1)} m/s
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-extrabold",
                          toNumber(reading.battery) >= 3.7
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {toNumber(reading.battery).toFixed(2)}V
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 size={15} />
                        {formatDate(reading.recorded_at)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">{sensorAgeLabel(reading.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default function DashboardShell({ initialData }: DashboardShellProps) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/dashboard", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: DashboardPayload) => setData(payload))
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const openShelters = useMemo(
    () => data.shelters.filter((shelter) => shelter.status === "open").length,
    [data.shelters],
  );

  const cards = [
    {
      label: "สถานีตรวจวัด",
      value: data.summary.stationsOnline,
      detail: "จำนวนสถานีหลักลุ่มน้ำ",
      corner: "สถานการณ์ปกติ",
      icon: Radio,
      className: "from-[#2f68f0] to-[#1d45bc]",
    },
    {
      label: "ระดับน้ำอ้างอิงเก็บน้ำ (PY-01)",
      value: data.summary.latestWaterLevel.toFixed(2),
      suffix: "ม. (รทก.)",
      detail: "อัปเดตล่าสุด",
      icon: Gauge,
      className: "from-[#18bfd0] to-[#1976f0]",
    },
    {
      label: "ปริมาณน้ำฝนสะสมลุ่มน้ำ",
      value: data.summary.rainfall24h.toFixed(1),
      suffix: "มิลลิเมตร",
      detail: "รวม 24 ชม.",
      icon: CloudRain,
      className: "from-[#6768f0] to-[#07549d]",
    },
    {
      label: "พื้นที่พยากรณ์น้ำท่วม",
      value: data.summary.warningAreas,
      detail: "จุดเตือนภัย",
      corner: "เฝ้าระวัง",
      icon: Siren,
      className: "from-[#ff4965] to-[#cf1016]",
    },
    {
      label: "พื้นที่เสี่ยงภัยและพักพิง",
      value: data.summary.shelters,
      detail: "แห่งเตรียมพร้อม",
      corner: "ศูนย์พักพิง",
      icon: LifeBuoy,
      className: "from-[#ffb23f] to-[#f8d9aa]",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-900">
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 w-[252px] bg-[#10192b] text-slate-200 shadow-2xl transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/8 px-5">
          <div className="grid size-10 place-items-center rounded-[8px] bg-[#0e82ff] text-white shadow-lg shadow-blue-950/30">
            <TestTubeDiagonal size={23} strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-[15px] font-extrabold tracking-[0.08em] text-[#48a8ff]">SMART BASIN</p>
            <p className="text-[11px] font-medium text-slate-400">ลุ่มน้ำป่าพะยอม V1.0</p>
          </div>
        </div>

        <nav className="space-y-5 px-3 py-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[11px] font-bold tracking-wide text-slate-500">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    disabled={!item.id}
                    onClick={() => {
                      if (item.id) {
                        setActiveView(item.id as ViewId);
                        setSidebarOpen(false);
                      }
                    }}
                    className={[
                      "flex h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left text-[13px] font-bold transition",
                      item.id === activeView
                        ? "bg-[#0879df] text-white shadow-lg shadow-blue-950/25"
                        : item.id
                          ? "text-slate-300 hover:bg-white/7 hover:text-white"
                          : "cursor-not-allowed text-slate-500",
                    ].join(" ")}
                  >
                    <item.icon size={17} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/92 px-4 shadow-sm backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="เปิดเมนู"
              className="grid size-10 place-items-center rounded-[8px] border border-slate-200 bg-white text-slate-700 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="size-2.5 rounded-full bg-[#1688f4] shadow-[0_0_0_5px_rgba(22,136,244,0.10)]" />
            <h1 className="truncate text-[17px] font-extrabold text-slate-800 md:text-[19px]">
              ระบบอัจฉริยะลุ่มน้ำป่าพะยอม
            </h1>
            <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 md:inline-flex">
              AI คาดการณ์น้ำแล้ง-น้ำท่วม
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button aria-label="แจ้งเตือน" className="relative grid size-10 place-items-center rounded-[8px] text-slate-500 hover:bg-slate-100">
              <Bell size={19} />
              <span className="absolute right-2.5 top-2 size-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button className="hidden items-center gap-3 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
              <span className="text-right">
                <span className="block text-xs font-extrabold text-slate-700">ศรัญญู ป่าพะยอม</span>
                <span className="block text-[10px] font-bold text-slate-400">ADMIN</span>
              </span>
              <span className="grid size-9 place-items-center rounded-[8px] bg-blue-100 text-blue-600">
                <Users size={19} />
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </div>
        </header>

        <main className="px-4 py-5 md:px-8">
          <div className="mb-7 flex items-center gap-3 rounded-[8px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-emerald-500">
              <Waves size={16} />
            </span>
            เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับคุณ ศรัญญู ป่าพะยอม (ผู้ดูแลระบบ) บทบาท: admin
          </div>

          {activeView === "sensors" ? (
            <SensorDataView />
          ) : (
            <>
              <section className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-800 md:text-3xl">หน้าต่างสรุปผลสถานการณ์น้ำ (Dashboard)</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    สรุปข้อมูลการตรวจวัด การแจ้งเตือนภัยพยากรณ์ล่วงหน้า และการประสานงานของชุมชนลุ่มน้ำป่าพะยอม
                  </p>
                </div>
                <div className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
                  ข้อมูลล่าสุด ณ เวลา: {formatDate(data.updatedAt)}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {cards.map((card) => (
              <article
                key={card.label}
                className={`min-h-[132px] rounded-[8px] bg-gradient-to-br ${card.className} p-5 text-white shadow-xl shadow-slate-300/50`}
              >
                <div className="mb-6 flex items-start justify-between gap-3">
                  <span className="grid size-12 place-items-center rounded-[8px] bg-white/16">
                    <card.icon size={21} />
                  </span>
                  {card.corner && <span className="text-[11px] font-extrabold text-white/92">{card.corner}</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[30px] font-extrabold leading-none">{card.value}</span>
                  {card.suffix && <span className="text-xs font-extrabold text-white/90">{card.suffix}</span>}
                </div>
                <p className="mt-2 text-xs font-extrabold text-white/94">{card.label}</p>
                <p className="text-[11px] font-bold text-white/78">{card.detail}</p>
              </article>
            ))}
              </section>

              <section className="mt-7 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-1 size-3 rounded-full bg-emerald-500" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">แผนที่จำลองพิกัดและสถานการณ์น้ำลุ่มน้ำป่าพะยอม</h3>
                  <p className="text-xs font-medium text-slate-500">
                    แสดงตำแหน่งภูมิศาสตร์จริงจากฐานข้อมูล ศูนย์พักพิง และพื้นที่เฝ้าระวังในระบบลุ่มน้ำ
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-[8px] bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-700">น้ำเก็บกัก</span>
                <span className="rounded-[8px] bg-cyan-50 px-3 py-1.5 text-xs font-extrabold text-cyan-700">ฝายทดน้ำ</span>
                <span className="rounded-[8px] bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">จุดแจ้งเหตุ</span>
              </div>
            </div>

            <div className="grid min-h-[520px] lg:grid-cols-[1fr_320px]">
              <div className="h-[520px] min-w-0">
                <BasinMap data={data} />
              </div>
              <aside className="border-t border-slate-100 bg-slate-50/70 p-4 lg:border-l lg:border-t-0">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800">ศูนย์พักพิง</h4>
                    <p className="text-xs font-medium text-slate-500">
                      {data.source === "database" ? "ข้อมูลจาก PostgreSQL" : "ข้อมูลตัวอย่าง"}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">
                    เปิด {openShelters}
                  </span>
                </div>
                <div className="space-y-3 overflow-auto pr-1 lg:max-h-[438px]">
                  {data.shelters.slice(0, 10).map((shelter) => (
                    <article key={shelter.id} className="rounded-[8px] border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-slate-800">{shelter.name}</p>
                          <p className="text-xs font-medium text-slate-500">รองรับ {shelter.capacity.toLocaleString("th-TH")} คน</p>
                        </div>
                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold",
                            shelter.status === "open"
                              ? "bg-emerald-100 text-emerald-700"
                              : shelter.status === "full"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700",
                          ].join(" ")}
                        >
                          {shelter.status === "open" ? "เปิด" : shelter.status === "full" ? "เต็ม" : "เตรียมพร้อม"}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <MapPinned size={13} />
                        {shelter.lat.toFixed(4)}, {shelter.lng.toFixed(4)}
                      </p>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
