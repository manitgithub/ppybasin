"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudRain,
  CloudSun,
  Database,
  Droplets,
  Home,
  Hospital,
  LifeBuoy,
  Megaphone,
  Siren,
  Users,
} from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard-data";

const BasinMap = dynamic(() => import("@/components/BasinMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">กำลังโหลดแผนที่...</div>,
});

const alertItems = [
  { title: "น้ำท่วมฉับพลัน", area: "อ.ป่าพะยอม ต.คลองทรายขาว", time: "20 พ.ค. 2567 10:15", tone: "red" },
  { title: "ระดับน้ำเพิ่มขึ้นรวดเร็ว", area: "อ.ตะโหมด ต.แม่ขรี", time: "20 พ.ค. 2567 09:45", tone: "orange" },
  { title: "ฝนตกหนักต่อเนื่อง", area: "อ.ศรีบรรพต", time: "20 พ.ค. 2567 09:30", tone: "amber" },
];

const weatherDays = ["อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา.", "จ."];
const shelterCards = [
  ["ศ.พยพบ้านคลอง...", "อ.ป่าพะยอม", "500", "230"],
  ["ศ.พยพโรงเรียนตะโหมด", "อ.ตะโหมด", "400", "180"],
  ["ศ.พยพวัดท่าแค", "อ.ศรีบรรพต", "600", "320"],
  ["ศ.พยพ อบต.ควนขนุน", "อ.ควนขนุน", "450", "210"],
  ["ศ.พยพบ้านนาท่อม", "อ.นาแก้ว", "500", "90"],
];

const waterRows = [
  ["สถานีบ้านหัวลำ", "7.35 ม.", "เฝ้าระวัง", "orange"],
  ["สถานีคลองทรายขาว", "6.80 ม.", "เฝ้าระวัง", "orange"],
  ["สถานีบ้านแม่ขรี", "5.20 ม.", "ปกติ", "teal"],
  ["สถานีบ้านโตนดด้วน", "3.10 ม.", "ปกติ", "teal"],
];

const summaryRows = [
  ["หมู่บ้านได้รับผลกระทบ", "18 หมู่บ้าน", Users],
  ["ครัวเรือน", "3,245 ครัวเรือน", Database],
  ["ประชาชนได้รับผลกระทบ", "1,247 คน", Users],
  ["ผู้อพยพในศูนย์อพยพ", "1,030 คน", Hospital],
  ["ผู้เสียชีวิต", "0 ราย", Clock3],
  ["ผู้บาดเจ็บ", "2 ราย", LifeBuoy],
];

const newsItems = [
  ["20 พ.ค. 2567 09:00", "ประกาศเตือนภัยน้ำท่วมฉับพลันในพื้นที่ อ.ป่าพะยอม"],
  ["19 พ.ค. 2567 16:30", "เฝ้าระวังระดับน้ำเพิ่มขึ้นในลำน้ำสายหลัก"],
  ["19 พ.ค. 2567 10:15", "เปิดศูนย์อพยพเพิ่ม 2 แห่ง ใน อ.ตะโหมด"],
];

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
      <div className="flex h-11 items-center justify-between border-b border-slate-100 px-4">
        <h3 className="text-sm font-extrabold text-[#20325c]">{title}</h3>
        {action && <button className="text-xs font-extrabold text-[#2c72d9]">{action}</button>}
      </div>
      {children}
    </section>
  );
}

function MiniSparkline() {
  return (
    <svg viewBox="0 0 90 22" className="h-6 w-24 text-sky-400" aria-hidden="true">
      <path d="M2 14 C14 13 17 7 28 10 S44 18 55 11 70 7 88 13" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export default function DashboardHome({
  data,
  openShelters,
}: {
  data: DashboardPayload;
  openShelters: number;
}) {
  const cards = [
    {
      label: "ปริมาณฝนวันนี้",
      value: "128.5",
      suffix: "มม.",
      detail: "↑ 26% จากเมื่อวาน",
      icon: CloudRain,
      className: "from-[#2f8ee8] to-[#0b5fbe]",
    },
    {
      label: "ระดับน้ำลุ่มน้ำป่าพะยอม",
      value: data.summary.latestWaterLevel.toFixed(2),
      suffix: "ม.",
      detail: "↑ สูงกว่าปกติ 1.25 ม.",
      icon: Droplets,
      className: "from-[#51c9c6] to-[#07979d]",
    },
    {
      label: "พื้นที่เสี่ยงน้ำท่วม",
      value: "18",
      suffix: "หมู่บ้าน",
      detail: "3,245 ครัวเรือน",
      icon: Home,
      className: "from-[#ffb23b] to-[#ed7708]",
    },
    {
      label: "ศูนย์พักพิงเปิดดำเนินการ",
      value: "6",
      suffix: "ศูนย์",
      detail: "รองรับได้ 2,450 คน",
      icon: Siren,
      className: "from-[#ff675e] to-[#e12624]",
    },
    {
      label: "ประชาชนได้รับผลกระทบ",
      value: "1,247",
      suffix: "คน",
      detail: "จาก 18 หมู่บ้าน",
      icon: Users,
      className: "from-[#b387ea] to-[#7b4bd0]",
    },
  ];

  return (
    <div className="space-y-3">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className={`min-h-[108px] rounded-[8px] bg-gradient-to-br ${card.className} px-5 py-4 text-white shadow-sm`}>
            <div className="flex items-center gap-3">
              <card.icon className="size-9 shrink-0 text-white" strokeWidth={2.7} />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white/90">{card.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[26px] font-extrabold leading-none">{card.value}</span>
                  <span className="text-sm font-extrabold">{card.suffix}</span>
                </div>
                <p className="mt-1 truncate text-xs font-bold text-white/85">{card.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.62fr)_minmax(300px,0.62fr)]">
        <Panel title="แผนที่สถานการณ์ น้ำท่วมแบบเรียลไทม์">
          <div className="relative h-[470px] overflow-hidden rounded-b-[8px]">
            <BasinMap data={data} />
            <div className="absolute left-4 top-4 w-[160px] rounded-[8px] bg-[#102130]/92 p-4 text-white shadow-xl">
              <div className="mb-3 flex items-center justify-between text-xs font-extrabold">
                ชั้นข้อมูล
                <ChevronDown size={15} />
              </div>
              {["ปริมาณฝน", "ระดับน้ำ", "พื้นที่เสี่ยงน้ำท่วม", "พื้นที่เสี่ยงน้ำแล้ง", "ศูนย์อพยพ", "เส้นทางอพยพ", "จุดอุปกรณ์เตือนภัย"].map((layer, index) => (
                <label key={layer} className="mb-2 flex items-center gap-2 text-[11px] font-bold">
                  <span className={["size-3 rounded-[3px]", index < 2 ? "bg-[#2f8ee8]" : index === 2 ? "bg-[#ff573d]" : index === 3 ? "bg-[#f59e0b]" : index === 4 ? "bg-[#38b86a]" : "bg-sky-400"].join(" ")} />
                  {layer}
                </label>
              ))}
              <p className="mt-4 text-[11px] font-extrabold">ปริมาณฝน (มม.)</p>
              {["> 200", "150 - 200", "100 - 150", "50 - 100", "25 - 50", "0 - 25"].map((label, index) => (
                <div key={label} className="mt-2 flex items-center gap-2 text-[11px] font-bold">
                  <span className={["size-3 rounded-[3px]", ["bg-red-600", "bg-orange-500", "bg-amber-300", "bg-yellow-300", "bg-lime-400", "bg-sky-400"][index]].join(" ")} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="การแจ้งเตือนล่าสุด" action="ดูทั้งหมด">
            <div className="space-y-2 p-3">
              {alertItems.map((item) => (
                <article key={item.title} className="flex items-center gap-3 rounded-[8px] bg-orange-50/80 p-3">
                  <span className={["grid size-9 place-items-center rounded-[8px] text-white", item.tone === "red" ? "bg-red-500" : item.tone === "orange" ? "bg-orange-500" : "bg-amber-500"].join(" ")}>
                    <AlertTriangle size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={["truncate text-sm font-extrabold", item.tone === "red" ? "text-red-600" : "text-orange-600"].join(" ")}>{item.title}</p>
                    <p className="truncate text-xs font-bold text-slate-600">{item.area}</p>
                    <p className="text-[11px] font-semibold text-slate-400">{item.time}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="ระดับน้ำในลำน้ำสำคัญ">
            <div className="p-3">
              <div className="mb-2 flex justify-end gap-3 text-[10px] font-bold text-slate-500">
                <span className="text-sky-500">● ระดับน้ำ</span>
                <span className="text-orange-500">● ระดับเฝ้าระวัง</span>
                <span className="text-red-500">● ระดับวิกฤต</span>
              </div>
              {waterRows.map((row) => (
                <div key={row[0]} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-t border-slate-100 py-2 text-xs">
                  <span className="font-extrabold text-[#284069]">{row[0]}</span>
                  <span className="font-extrabold text-[#5370a0]">{row[1]}</span>
                  <MiniSparkline />
                  <span className={row[3] === "orange" ? "font-bold text-orange-500" : "font-bold text-teal-600"}>● {row[2]}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="พยากรณ์อากาศ">
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#63718a]">7 วันข้างหน้า</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-extrabold text-[#2267c7]"><CloudSun size={17} /> ฝนตกหนัก</p>
                </div>
                <div className="text-right text-[#2c72d9]">
                  <CloudRain size={50} className="ml-auto opacity-60" />
                  <p className="text-xs font-extrabold">80%</p>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {weatherDays.map((day, index) => (
                  <div key={day} className="rounded-[8px] bg-slate-50 py-2">
                    <p className="text-xs font-extrabold text-slate-600">{day}</p>
                    <CloudRain className="mx-auto my-1 size-5 text-sky-500" />
                    <p className="text-xs font-extrabold text-[#20325c]">{index === 3 ? "30°" : index > 4 ? "32°" : "31°"}</p>
                    <p className="text-[11px] font-bold text-[#2c72d9]">{index > 4 ? "25°" : "24°"}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="พื้นที่เสี่ยงน้ำท่วม">
            <div className="grid grid-cols-[120px_1fr] items-center gap-3 p-4">
              <div className="relative grid aspect-square place-items-center rounded-full bg-[conic-gradient(#1e88e5_0_35%,#05a587_35%_60%,#ffaf23_60%_80%,#ff6b35_80%_92%,#5dade2_92%_100%)]">
                <div className="grid size-16 place-items-center rounded-full bg-white text-xs font-extrabold text-[#20325c]">รวม</div>
              </div>
              <div className="space-y-2 text-xs font-bold text-[#40577f]">
                {["ป่าพะยอม 35%", "ตะโหมด 25%", "ศรีบรรพต 20%", "ควนขนุน 12%", "นาแก้ว 8%"].map((item) => (
                  <p key={item}>{item}</p>
                ))}
                <p className="border-t border-slate-100 pt-2 font-extrabold">รวม 100%</p>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.1fr_0.72fr_0.86fr]">
        <Panel title={`ศูนย์อพยพที่เปิดดำเนินการ (${openShelters} แห่ง)`} action="ดูทั้งหมด">
          <div className="flex gap-3 overflow-x-auto p-4">
            {shelterCards.map((shelter) => (
              <article key={shelter[0]} className="min-w-[138px] rounded-[8px] border border-slate-200 bg-white p-3 text-center">
                <Hospital className="mx-auto mb-2 size-9 text-emerald-600" />
                <p className="truncate text-xs font-extrabold text-[#20325c]">{shelter[0]}</p>
                <p className="text-[11px] font-bold text-[#63718a]">{shelter[1]}</p>
                <p className="mt-2 text-xs font-bold text-[#20325c]">รองรับ {shelter[2]} คน</p>
                <p className="text-xs font-extrabold text-[#2c72d9]">เข้าพัก {shelter[3]} คน</p>
              </article>
            ))}
          </div>
          <div className="flex justify-center gap-3 pb-3">
            {[0, 1, 2, 3, 4].map((dot) => <span key={dot} className={dot === 2 ? "size-2 rounded-full bg-[#2c72d9]" : "size-2 rounded-full bg-slate-300"} />)}
          </div>
        </Panel>

        <Panel title="สถานการณ์โดยสรุป">
          <div className="space-y-2 p-4">
            <p className="mb-2 text-xs font-bold text-slate-500">ข้อมูล ณ เวลา 10:30 น.</p>
            {summaryRows.map(([label, value, Icon]) => (
              <div key={label as string} className="flex items-center justify-between border-t border-slate-100 py-2 text-xs">
                <span className="flex items-center gap-2 font-bold text-[#40577f]"><Icon size={15} className="text-[#2c72d9]" />{label as string}</span>
                <span className="font-extrabold text-[#5370a0]">{value as string}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="ข่าวประชาสัมพันธ์" action="ดูทั้งหมด">
          <div className="space-y-3 p-4">
            {newsItems.map((item) => (
              <article key={item[0]} className="flex gap-3 rounded-[8px] border border-slate-100 bg-white p-3 shadow-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-blue-50 text-[#2c72d9]">
                  <Megaphone size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold text-[#2c72d9]">{item[0]}</p>
                  <p className="text-xs font-bold text-[#40577f]">{item[1]}</p>
                </div>
              </article>
            ))}
            <button className="h-10 w-full rounded-[8px] bg-[#216ed7] text-sm font-extrabold text-white">ดูข่าวทั้งหมด</button>
          </div>
        </Panel>
      </section>
    </div>
  );
}
