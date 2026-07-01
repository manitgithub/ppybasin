"use client";

import { CalendarDays, FileText, Home, MapPin, RadioTower, Users } from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard-data";
import type { ViewId } from "@/components/dashboard/types";
import { formatDate } from "@/components/dashboard/utils";

type CategoryViewId = Extract<ViewId, "village-basics" | "announcements">;

const villageRows = [
  {
    name: "บ้านป่าพะยอม",
    tambon: "ป่าพะยอม",
    households: 684,
    population: 2140,
    risk: "เฝ้าระวัง",
    shelter: "ศูนย์พักพิงเทศบาลป่าพะยอม",
  },
  {
    name: "บ้านทุ่งยาว",
    tambon: "ลานข่อย",
    households: 428,
    population: 1368,
    risk: "ปกติ",
    shelter: "โรงเรียนบ้านทุ่งยาว",
  },
  {
    name: "บ้านคลองทรายขาว",
    tambon: "เกาะเต่า",
    households: 512,
    population: 1715,
    risk: "เฝ้าระวัง",
    shelter: "ศาลาอเนกประสงค์บ้านคลองทรายขาว",
  },
  {
    name: "บ้านหัวลำ",
    tambon: "ป่าพะยอม",
    households: 391,
    population: 1230,
    risk: "เสี่ยงสูง",
    shelter: "วัดบ้านหัวลำ",
  },
];

const announcementRows = [
  {
    title: "ประกาศเตือนภัยน้ำท่วมฉับพลันในพื้นที่ อ.ป่าพะยอม",
    category: "เตือนภัย",
    status: "เผยแพร่แล้ว",
    publishedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    title: "เฝ้าระวังระดับน้ำเพิ่มขึ้นในลำน้ำสายหลัก",
    category: "เฝ้าระวัง",
    status: "เผยแพร่แล้ว",
    publishedAt: "2026-06-30T16:30:00.000Z",
  },
  {
    title: "เปิดศูนย์อพยพสำรองเพิ่มเติมในเขตพื้นที่เสี่ยง",
    category: "ปฏิบัติการ",
    status: "ร่างประกาศ",
    publishedAt: "2026-06-30T10:15:00.000Z",
  },
];

const categoryMeta = {
  "village-basics": {
    icon: Home,
    eyebrow: "VILLAGE MASTER DATA",
    title: "ข้อมูลพื้นฐานหมู่บ้าน",
    detail: "ทะเบียนข้อมูลหมู่บ้าน ครัวเรือน ประชากร ระดับความเสี่ยง และศูนย์พักพิงที่ใช้ประสานงาน",
  },
  announcements: {
    icon: FileText,
    eyebrow: "ANNOUNCEMENTS",
    title: "ประกาศข่าว",
    detail: "คลังประกาศและข่าวสารสำหรับแจ้งเตือน ประสานงานภาคสนาม และติดตามสถานะการเผยแพร่",
  },
} satisfies Record<CategoryViewId, { icon: typeof Home; eyebrow: string; title: string; detail: string }>;

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Home;
}) {
  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-normal text-[#20325c]">{value}</p>
        </div>
        <span className="grid size-11 place-items-center rounded-[8px] bg-blue-50 text-[#216ed7]">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function VillageBasics({ data }: { data: DashboardPayload }) {
  const households = villageRows.reduce((sum, row) => sum + row.households, 0);
  const population = villageRows.reduce((sum, row) => sum + row.population, 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="หมู่บ้านในคลัง" value={`${villageRows.length.toLocaleString("th-TH")} หมู่บ้าน`} icon={Home} />
        <StatCard label="ครัวเรือนรวม" value={households.toLocaleString("th-TH")} icon={Users} />
        <StatCard label="สถานีอ้างอิง" value={`${data.summary.stationsOnline.toLocaleString("th-TH")} สถานี`} icon={RadioTower} />
      </div>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-extrabold text-slate-800">ทะเบียนหมู่บ้าน</h3>
          <p className="text-xs font-medium text-slate-500">ข้อมูลตัวอย่างสำหรับใช้ต่อยอดกับตารางฐานข้อมูลจริง</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
              <tr>
                <th className="px-5 py-3">หมู่บ้าน</th>
                <th className="px-5 py-3">ตำบล</th>
                <th className="px-5 py-3">ครัวเรือน</th>
                <th className="px-5 py-3">ประชากร</th>
                <th className="px-5 py-3">ระดับความเสี่ยง</th>
                <th className="px-5 py-3">ศูนย์พักพิงหลัก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {villageRows.map((row) => (
                <tr key={row.name} className="hover:bg-blue-50/45">
                  <td className="px-5 py-4 font-extrabold text-slate-800">{row.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-600">{row.tambon}</td>
                  <td className="px-5 py-4 font-bold text-slate-700">{row.households.toLocaleString("th-TH")}</td>
                  <td className="px-5 py-4 font-bold text-slate-700">{row.population.toLocaleString("th-TH")}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700">{row.risk}</span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{row.shelter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-xs font-bold text-slate-500">
          ประชากรรวม {population.toLocaleString("th-TH")} คน
        </div>
      </section>
    </>
  );
}

function Announcements() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="ประกาศทั้งหมด" value={`${announcementRows.length.toLocaleString("th-TH")} รายการ`} icon={FileText} />
        <StatCard label="เผยแพร่แล้ว" value={`${announcementRows.filter((row) => row.status === "เผยแพร่แล้ว").length.toLocaleString("th-TH")} รายการ`} icon={CalendarDays} />
        <StatCard label="พื้นที่เชื่อมโยง" value="ลุ่มน้ำป่าพะยอม" icon={MapPin} />
      </div>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-extrabold text-slate-800">รายการประกาศข่าว</h3>
          <p className="text-xs font-medium text-slate-500">แยกหมวดหมู่และสถานะเพื่อใช้ตรวจสอบก่อนเผยแพร่</p>
        </div>
        <div className="divide-y divide-slate-100">
          {announcementRows.map((row) => (
            <article key={row.title} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-extrabold text-blue-700">{row.category}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">{row.status}</span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-800">{row.title}</h4>
              </div>
              <p className="text-xs font-bold text-slate-500">{formatDate(row.publishedAt)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default function DataWarehouseCategoryView({
  viewId,
  data,
}: {
  viewId: CategoryViewId;
  data: DashboardPayload;
}) {
  const meta = categoryMeta[viewId];
  const Icon = meta.icon;

  return (
    <section className="space-y-6">
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

      {viewId === "village-basics" ? <VillageBasics data={data} /> : <Announcements />}
    </section>
  );
}
