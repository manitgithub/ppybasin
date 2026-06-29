"use client";

import { AlertTriangle, ChartNoAxesCombined, Hospital, Map, Settings, Waves } from "lucide-react";
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
    </section>
  );
}
