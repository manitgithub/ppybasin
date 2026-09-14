"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
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
import type { SituationPayload } from "@/lib/situation/adapters";

const BasinMap = dynamic(() => import("@/components/BasinMap"), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

const weatherDays = ["อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา.", "จ."];
const shelterCards = [
  ["ศ.พยพบ้านคลอง...", "อ.ป่าพะยอม", "500", "230"],
  ["ศ.พยพโรงเรียนตะโหมด", "อ.ตะโหมด", "400", "180"],
  ["ศ.พยพวัดท่าแค", "อ.ศรีบรรพต", "600", "320"],
  ["ศ.พยพ อบต.ควนขนุน", "อ.ควนขนุน", "450", "210"],
  ["ศ.พยพบ้านนาท่อม", "อ.นาแก้ว", "500", "90"],
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

const rainLoopUrl = "https://semet.uk/loop/PTLLoop.gif";
const tmdForecastUrl = "https://www.tmd.go.th/weather/region/southerneastcoast";

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function waterSituationLabel(level: number | null | undefined) {
  if (typeof level !== "number") return { label: "รอยืนยัน", className: "text-slate-500", dotClassName: "bg-slate-400" };
  if (level >= 4) return { label: "วิกฤต", className: "text-red-600", dotClassName: "bg-red-500" };
  if (level >= 3) return { label: "ควรจับตา", className: "text-orange-600", dotClassName: "bg-orange-500" };
  if (level >= 2) return { label: "เฝ้าระวัง", className: "text-sky-600", dotClassName: "bg-sky-500" };
  return { label: "ปกติ", className: "text-teal-600", dotClassName: "bg-teal-500" };
}

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

function MapPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500">
      กำลังโหลดแผนที่...
    </div>
  );
}

export default function DashboardHome({
  data,
  openShelters,
}: {
  data: DashboardPayload;
  openShelters: number;
}) {
  const [mapReady, setMapReady] = useState(false);
  const [situation, setSituation] = useState<SituationPayload | null>(null);

  useEffect(() => {
    const scheduleMap = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 250));
    const cancelMap = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = scheduleMap(() => setMapReady(true), { timeout: 900 });

    return () => cancelMap(handle);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/situation", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SituationPayload>;
      })
      .then((payload) => setSituation(payload))
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const importantWaterRows = useMemo(() => {
    return [...(situation?.thaiWater.waterLevels ?? [])]
      .filter((station) => station.waterLevelMsl !== null || station.waterLevelM !== null)
      .sort((a, b) => {
        const levelDiff = (b.situationLevel ?? 0) - (a.situationLevel ?? 0);
        if (levelDiff !== 0) return levelDiff;
        return (b.waterLevelMsl ?? b.waterLevelM ?? 0) - (a.waterLevelMsl ?? a.waterLevelM ?? 0);
      })
      .slice(0, 4);
  }, [situation?.thaiWater.waterLevels]);

  const latestRealWaterLevel = importantWaterRows[0] ?? null;

  const cards = useMemo(
    () => [
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
        value: latestRealWaterLevel ? formatNumber(latestRealWaterLevel.waterLevelMsl ?? latestRealWaterLevel.waterLevelM, 2) : "-",
        suffix: latestRealWaterLevel ? (latestRealWaterLevel.waterLevelMsl !== null ? "ม.รทก." : "ม.") : "",
        detail: latestRealWaterLevel ? `${latestRealWaterLevel.name} • ${formatDateTime(latestRealWaterLevel.observedAt)}` : "รอข้อมูลจริงจาก ThaiWater/สสน.",
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
    ],
    [latestRealWaterLevel],
  );

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

      <section className="grid gap-3 xl:grid-cols-2">
        <Panel title="แผนที่สถานการณ์ น้ำท่วมแบบเรียลไทม์">
          <div className="relative h-[470px] overflow-hidden rounded-b-[8px]">
            {mapReady ? <BasinMap data={data} /> : <MapPlaceholder />}
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

        <Panel title="ภาพวนซ้ำเรดาร์ฝน พัทลุง">
          <div className="relative h-[470px] overflow-hidden bg-slate-900">
            <Image
              src={rainLoopUrl}
              alt="ภาพวนซ้ำเรดาร์ฝนพื้นที่พัทลุง"
              fill
              unoptimized
              sizes="(min-width: 1280px) 50vw, 100vw"
              className="object-contain"
            />
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-[11px] font-bold text-slate-500">
            ที่มา:{" "}
            <a className="font-extrabold text-[#2c72d9]" href={rainLoopUrl} target="_blank" rel="noreferrer">
              SEMET PTL radar loop
            </a>
          </div>
        </Panel>

        <Panel title="ระดับน้ำในลำน้ำสำคัญ">
            <div className="p-3">
              <div className="mb-1 flex flex-wrap justify-end gap-2 text-[10px] font-bold text-slate-500">
                <span className="text-teal-600">● ปกติ</span>
                <span className="text-orange-500">● เฝ้าระวัง</span>
                <span className="text-red-500">● วิกฤต</span>
              </div>
              {importantWaterRows.length ? (
                <>
                  <p className="mb-2 text-[11px] font-bold text-slate-500">ข้อมูลจริงจาก ThaiWater/สสน. จังหวัดพัทลุง</p>
                  {importantWaterRows.map((station) => {
                    const situationLabel = waterSituationLabel(station.situationLevel);
                    const waterLevel = station.waterLevelMsl ?? station.waterLevelM;
                    const unit = station.waterLevelMsl !== null ? "ม.รทก." : "ม.";

                    return (
                      <div key={station.id} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-slate-100 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-extrabold text-[#284069]">{station.name}</p>
                          <p className="truncate text-[11px] font-semibold text-slate-500">{station.river} • {formatDateTime(station.observedAt)}</p>
                          <p className={`mt-0.5 flex items-center gap-1 font-bold ${situationLabel.className}`}>
                            <span className={`size-2 rounded-full ${situationLabel.dotClassName}`} />
                            {situationLabel.label}
                          </p>
                        </div>
                        <span className="text-right font-extrabold text-[#5370a0]">
                          {formatNumber(waterLevel, 2)}
                          <span className="ml-1 text-[10px] font-bold text-slate-500">{unit}</span>
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="border-t border-slate-100 py-4 text-xs font-bold text-slate-500">
                  ยังไม่มีข้อมูลระดับน้ำจริงที่ยืนยันได้จาก ThaiWater/สสน. จึงไม่แสดงรายการ mockup
                </div>
              )}
            </div>
        </Panel>

        <Panel title="พยากรณ์อากาศ">
            <div className="p-3">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#63718a]">กรมอุตุนิยมวิทยา</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-extrabold text-[#2267c7]">
                    <CloudSun size={17} />
                    {situation?.tmd.daily.heavyRainText ?? situation?.tmd.daily.probabilityPercent ?? "รอข้อมูลจริง"}
                  </p>
                </div>
                <div className="text-right text-[#2c72d9]">
                  <CloudRain size={38} className="ml-auto opacity-60" />
                  <p className="text-xs font-extrabold">{situation?.tmd.daily.probabilityPercent ?? "-"}</p>
                </div>
              </div>

              {situation ? (
                <div className="space-y-2">
                  {[situation.tmd.daily, situation.tmd.sevenDay].map((forecast, index) => (
                    <div key={forecast.sourceUrl} className="rounded-[8px] bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-extrabold text-slate-700">{index === 0 ? "24 ชั่วโมง" : "แนวโน้ม 7 วัน"}</p>
                        <span className={forecast.status === "ok" ? "text-[11px] font-extrabold text-emerald-700" : "text-[11px] font-extrabold text-amber-700"}>
                          {forecast.status === "ok" ? "ข้อมูลจริง" : "ตรวจสอบแหล่งข้อมูล"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-600">{forecast.evidence}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                        <span className="rounded-[7px] bg-sky-100 px-2 py-1 text-sky-700">โอกาสฝน {forecast.probabilityPercent ?? "-"}</span>
                        <span className="rounded-[7px] bg-amber-100 px-2 py-1 text-amber-800">{forecast.heavyRainText ?? "ไม่พบคำฝนหนัก"}</span>
                      </div>
                    </div>
                  ))}
                  <a className="block text-[11px] font-extrabold text-[#2c72d9]" href={tmdForecastUrl} target="_blank" rel="noreferrer">
                    ที่มา: กรมอุตุนิยมวิทยา ภาคใต้ฝั่งตะวันออก
                  </a>
                </div>
              ) : (
                <div className="rounded-[8px] bg-slate-50 px-3 py-4 text-xs font-bold text-slate-500">
                  กำลังโหลดข้อมูลพยากรณ์อากาศจริงจากเมนูติดตามสถานการณ์...
                </div>
              )}

              {!situation && (
                <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                  {weatherDays.map((day) => (
                    <div key={day} className="rounded-[8px] bg-slate-50 py-2">
                      <p className="text-xs font-extrabold text-slate-600">{day}</p>
                      <CloudRain className="mx-auto my-1 size-5 text-sky-500" />
                      <p className="text-xs font-extrabold text-[#20325c]">-</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </Panel>
      </section>

      <section className="grid gap-3 [contain-intrinsic-size:430px] [content-visibility:auto] md:grid-cols-2 xl:grid-cols-[1.1fr_0.72fr_0.86fr]">
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
