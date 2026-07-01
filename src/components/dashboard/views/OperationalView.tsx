"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  ChartNoAxesCombined,
  CheckCircle2,
  Database,
  Hospital,
  KeyRound,
  Map,
  RadioTower,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard-data";
import type { ViewId } from "@/components/dashboard/types";

const viewMeta = {
  tracking: {
    icon: Waves,
    eyebrow: "SITUATION TRACKING",
    title: "ติดตามสถานการณ์",
    detail: "ภาพรวมสถานการณ์ฝน ระดับน้ำ จุดเฝ้าระวัง และสถานะชุมชนในพื้นที่ป่าพะยอม",
  },
  forecast: {
    icon: AlertTriangle,
    eyebrow: "FORECAST & ALERT",
    title: "คาดการณ์และแจ้งเตือน",
    detail: "พื้นที่สำหรับกติกาแจ้งเตือน การคาดการณ์ล่วงหน้า และ workflow รับรองประกาศ",
  },
  risk: {
    icon: ChartNoAxesCombined,
    eyebrow: "RISK ANALYTICS",
    title: "วิเคราะห์ความเสี่ยง",
    detail: "สรุประดับความเสี่ยงรายพื้นที่และแนวโน้มผลกระทบต่อครัวเรือน/ศูนย์อพยพ",
  },
  "evacuation-map": {
    icon: Map,
    eyebrow: "EVACUATION MAP",
    title: "แผนที่และเส้นทางอพยพ",
    detail: "หน้าสำหรับแผนเส้นทางอพยพ จุดรวมพล และการเลือกศูนย์อพยพตามสถานการณ์",
  },
  shelters: {
    icon: Hospital,
    eyebrow: "SHELTER OPS",
    title: "ศูนย์อพยพ",
    detail: "ติดตาม capacity ผู้เข้าพัก สถานะเปิดบริการ และการประสานทรัพยากร",
  },
  settings: {
    icon: Settings,
    eyebrow: "SYSTEM SETTINGS",
    title: "ตั้งค่าระบบ",
    detail: "ตั้งค่าระบบแจ้งเตือน สิทธิ์ระดับระบบ และการเชื่อมต่อข้อมูลภายนอก",
  },
} satisfies Partial<Record<ViewId, { icon: typeof Waves; eyebrow: string; title: string; detail: string }>>;

type OperationalViewId = keyof typeof viewMeta;

type SettingToggleProps = {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SettingToggle({ label, detail, checked, onChange }: SettingToggleProps) {
  return (
    <label className="flex min-h-16 items-center justify-between gap-4 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3">
      <span>
        <span className="block text-sm font-extrabold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs font-semibold text-slate-500">{detail}</span>
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 accent-[#216ed7]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ThresholdRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="text-sm font-extrabold text-slate-800">{label}</label>
        <span className="rounded-[8px] bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
          {value.toLocaleString("th-TH")} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="w-full accent-[#216ed7]"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function SettingsView({ data }: { data: DashboardPayload }) {
  const [waterWatch, setWaterWatch] = useState(5.5);
  const [waterCritical, setWaterCritical] = useState(7.2);
  const [rainWatch, setRainWatch] = useState(90);
  const [refreshSeconds, setRefreshSeconds] = useState(60);
  const [lineEnabled, setLineEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [publicNoticeEnabled, setPublicNoticeEnabled] = useState(true);
  const [autoApproveCritical, setAutoApproveCritical] = useState(false);
  const [sessionHours, setSessionHours] = useState(24);
  const [dataMode, setDataMode] = useState("realtime");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const healthRows = useMemo(
    () => [
      ["ฐานข้อมูล", data.source === "database" ? "เชื่อมต่อแล้ว" : "ใช้ fallback", data.source === "database"],
      ["สถานีตรวจวัด", `${data.summary.stationsOnline.toLocaleString("th-TH")} สถานี`, data.summary.stationsOnline > 0],
      ["ศูนย์อพยพ", `${data.summary.shelters.toLocaleString("th-TH")} แห่ง`, data.summary.shelters > 0],
    ],
    [data.source, data.summary.shelters, data.summary.stationsOnline],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <span className="grid size-10 place-items-center rounded-[8px] bg-amber-50 text-amber-700">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">เกณฑ์แจ้งเตือนสถานการณ์</h3>
              <p className="text-xs font-semibold text-slate-500">กำหนดระดับที่ระบบใช้แยกสถานะเฝ้าระวังและวิกฤต</p>
            </div>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <ThresholdRow label="ระดับน้ำเฝ้าระวัง" value={waterWatch} min={3} max={9} step={0.1} unit="ม." onChange={setWaterWatch} />
            <ThresholdRow label="ระดับน้ำวิกฤต" value={waterCritical} min={4} max={10} step={0.1} unit="ม." onChange={setWaterCritical} />
            <ThresholdRow label="ฝนสะสม 24 ชม. เฝ้าระวัง" value={rainWatch} min={30} max={250} step={5} unit="มม." onChange={setRainWatch} />
            <ThresholdRow label="รอบดึงข้อมูลอัตโนมัติ" value={refreshSeconds} min={15} max={300} step={15} unit="วินาที" onChange={setRefreshSeconds} />
          </div>
        </section>

        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <span className="grid size-10 place-items-center rounded-[8px] bg-emerald-50 text-emerald-700">
              <RadioTower size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">สถานะระบบข้อมูล</h3>
              <p className="text-xs font-semibold text-slate-500">ตรวจความพร้อมของแหล่งข้อมูลที่ dashboard ใช้งาน</p>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {healthRows.map(([label, value, ok]) => (
              <div key={label as string} className="flex items-center justify-between rounded-[8px] bg-slate-50 px-4 py-3">
                <span className="text-sm font-extrabold text-slate-700">{label as string}</span>
                <span className={ok ? "text-xs font-extrabold text-emerald-700" : "text-xs font-extrabold text-amber-700"}>
                  {value as string}
                </span>
              </div>
            ))}
            <label className="block">
              <span className="mb-2 block text-xs font-extrabold text-slate-500">โหมดข้อมูลหลัก</span>
              <select
                className="h-11 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
                value={dataMode}
                onChange={(event) => setDataMode(event.target.value)}
              >
                <option value="realtime">Realtime จากเซ็นเซอร์</option>
                <option value="verified">เฉพาะข้อมูลที่ตรวจสอบแล้ว</option>
                <option value="fallback">Fallback เมื่อระบบภายนอกล่ม</option>
              </select>
            </label>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-[8px] bg-blue-50 text-blue-700">
              <BellRing size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">ช่องทางแจ้งเตือน</h3>
              <p className="text-xs font-semibold text-slate-500">เลือกช่องทางที่ระบบใช้ส่งประกาศ</p>
            </div>
          </div>
          <div className="space-y-3">
            <SettingToggle label="LINE Notify/Official" detail="แจ้งเจ้าหน้าที่และกลุ่มปฏิบัติการ" checked={lineEnabled} onChange={setLineEnabled} />
            <SettingToggle label="SMS สำรอง" detail="ใช้เมื่ออินเทอร์เน็ตภาคสนามไม่เสถียร" checked={smsEnabled} onChange={setSmsEnabled} />
            <SettingToggle label="ประกาศหน้า dashboard" detail="แสดง banner สาธารณะในช่วงวิกฤต" checked={publicNoticeEnabled} onChange={setPublicNoticeEnabled} />
          </div>
        </section>

        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-[8px] bg-rose-50 text-rose-700">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">ความปลอดภัยและสิทธิ์</h3>
              <p className="text-xs font-semibold text-slate-500">ควบคุมการอนุมัติและระยะเวลา session</p>
            </div>
          </div>
          <div className="space-y-3">
            <SettingToggle label="อนุมัติประกาศวิกฤตอัตโนมัติ" detail="ใช้เฉพาะเมื่อระดับน้ำเกินวิกฤต" checked={autoApproveCritical} onChange={setAutoApproveCritical} />
            <label className="block rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mb-2 block text-sm font-extrabold text-slate-800">อายุ session ผู้ใช้</span>
              <select
                className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
                value={sessionHours}
                onChange={(event) => setSessionHours(Number(event.target.value))}
              >
                <option value={8}>8 ชั่วโมง</option>
                <option value={24}>24 ชั่วโมง</option>
                <option value={168}>7 วัน</option>
              </select>
            </label>
            <div className="flex items-center gap-3 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3">
              <KeyRound size={18} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-500">จัดการผู้ใช้จริงอยู่ที่เมนูจัดการสิทธิ์ผู้ใช้</span>
            </div>
          </div>
        </section>

        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-[8px] bg-cyan-50 text-cyan-700">
              <Database size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">การเชื่อมต่อภายนอก</h3>
              <p className="text-xs font-semibold text-slate-500">กำหนด endpoint สำหรับระบบภาคสนาม</p>
            </div>
          </div>
          <div className="space-y-3">
            {["Sensor webhook", "LINE Login", "Dashboard API"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-extrabold text-slate-700">{item}</span>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700">
                  <CheckCircle2 size={14} />
                  พร้อมใช้งาน
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-[8px] border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center">
        <p className="text-xs font-bold text-slate-500">
          {savedAt ? `บันทึกค่าล่าสุด: ${savedAt}` : "ปรับค่าแล้วกดบันทึกเพื่อใช้เป็นค่าเริ่มต้นของระบบ"}
        </p>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#216ed7] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#185bb4]"
          onClick={() => setSavedAt(new Date().toLocaleString("th-TH"))}
        >
          <Save size={17} />
          บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
}

export default function OperationalView({
  viewId,
  data,
}: {
  viewId: OperationalViewId;
  data: DashboardPayload;
}) {
  const meta = viewMeta[viewId];
  const Icon = meta.icon;

  return (
    <section className="space-y-4">
      <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="grid size-12 place-items-center rounded-[8px] bg-blue-50 text-[#216ed7]">
            <Icon size={24} />
          </span>
          <div>
            <p className="text-xs font-extrabold text-[#2c72d9]">{meta.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-extrabold text-[#20325c]">{meta.title}</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">{meta.detail}</p>
          </div>
        </div>
      </div>

      {viewId === "settings" ? (
        <SettingsView data={data} />
      ) : (
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[8px] bg-white p-5 shadow-sm">
          <p className="text-xs font-extrabold text-slate-500">ระดับน้ำล่าสุด</p>
          <p className="mt-2 text-3xl font-extrabold text-[#20325c]">{data.summary.latestWaterLevel.toFixed(2)} ม.</p>
        </article>
        <article className="rounded-[8px] bg-white p-5 shadow-sm">
          <p className="text-xs font-extrabold text-slate-500">ศูนย์พักพิงในระบบ</p>
          <p className="mt-2 text-3xl font-extrabold text-[#20325c]">{data.summary.shelters.toLocaleString("th-TH")}</p>
        </article>
        <article className="rounded-[8px] bg-white p-5 shadow-sm">
          <p className="text-xs font-extrabold text-slate-500">สถานีตรวจวัด</p>
          <p className="mt-2 text-3xl font-extrabold text-[#20325c]">{data.summary.stationsOnline.toLocaleString("th-TH")}</p>
        </article>
      </div>
      )}
    </section>
  );
}
