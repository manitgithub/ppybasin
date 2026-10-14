"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import DataSource, { type DataSourceInfo } from "@/components/DataSource";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Maximize,
  Megaphone,
  Minimize,
  RadioTower,
  Siren,
  Users,
  Waves,
} from "lucide-react";
import type { DashboardPayload } from "@/lib/dashboard-data";
import type { RainStation, SituationPayload } from "@/lib/situation/adapters";

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
const waterSource = {
  label: "ThaiWater · สถาบันสารสนเทศทรัพยากรน้ำ (สสน.)",
  url: "https://api-v3.thaiwater.net/api/v1/thaiwater30/provinces/waterlevel?province_code=93",
};
const rainSource = {
  label: "ThaiWater · สถาบันสารสนเทศทรัพยากรน้ำ (สสน.) · จังหวัดพัทลุง",
  url: "https://api-v3.thaiwater.net/api/v1/thaiwater30/provinces/rain24?include_zero=1&province_code=93",
};
const exampleSource = { label: "ข้อมูลตัวอย่างในระบบ · ยังไม่ได้เชื่อมต่อแหล่งข้อมูลจริง" };

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

function Panel({ title, action, sources, children }: { title: string; action?: string; sources?: DataSourceInfo[]; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[8px] border border-slate-200 bg-white shadow-sm">
      <div className="flex h-11 items-center justify-between border-b border-slate-100 px-4">
        <h3 className="text-sm font-extrabold text-[#20325c]">{title}</h3>
        {action && <button className="text-xs font-extrabold text-[#2c72d9]">{action}</button>}
      </div>
      {children}
      {sources && <div className="space-y-2 border-t border-slate-100 px-4 py-3">
        {sources.map((source) => <DataSource key={source.url ?? source.label} {...source} />)}
      </div>}
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [showWaterways, setShowWaterways] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showShelters, setShowShelters] = useState(true);

  useEffect(() => {
    const updateFullscreen = () => setMapFullscreen(document.fullscreenElement === mapContainer.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  async function toggleMapFullscreen() {
    try {
      setFullscreenError(false);
      if (document.fullscreenElement === mapContainer.current) {
        await document.exitFullscreen();
      } else {
        await mapContainer.current?.requestFullscreen();
      }
    } catch {
      setFullscreenError(true);
    }
  }

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
  const currentWaterSource = situation?.sources.find((source) => source.id === "thaiwater-waterlevel") ?? waterSource;
  const currentRainSource = situation?.sources.find((source) => source.id === "thaiwater-rain24h") ?? rainSource;
  const highestRainStation = useMemo(() => (situation?.thaiWater.rain24h ?? [])
    .filter((station) => Number.isFinite(station.rainfallMm) && station.rainfallMm >= 0)
    .reduce<RainStation | null>(
      (highest, station) => !highest || station.rainfallMm > highest.rainfallMm ? station : highest,
      null,
    ), [situation?.thaiWater.rain24h]);

  const cards = useMemo(
    () => [
      {
        label: "ฝนสะสม 24 ชม. สูงสุด",
        value: highestRainStation ? formatNumber(highestRainStation.rainfallMm, 1) : "-",
        suffix: "มม.",
        detail: highestRainStation ? `${highestRainStation.name} · อ.${highestRainStation.district} · ${formatDateTime(highestRainStation.observedAt)}` : "ยังไม่มีข้อมูลฝน 24 ชม. ที่ยืนยันได้จาก ThaiWater/สสน.",
        icon: CloudRain,
        source: currentRainSource,
        className: "from-[#2f8ee8] to-[#0b5fbe]",
      },
      {
        label: "ระดับน้ำลุ่มน้ำป่าพะยอม",
        value: latestRealWaterLevel ? formatNumber(latestRealWaterLevel.waterLevelMsl ?? latestRealWaterLevel.waterLevelM, 2) : "-",
        suffix: latestRealWaterLevel ? (latestRealWaterLevel.waterLevelMsl !== null ? "ม.รทก." : "ม.") : "",
        detail: latestRealWaterLevel ? `${latestRealWaterLevel.name} • ${formatDateTime(latestRealWaterLevel.observedAt)}` : "รอข้อมูลจริงจาก ThaiWater/สสน.",
        icon: Droplets,
        source: currentWaterSource,
        className: "from-[#51c9c6] to-[#07979d]",
      },
      {
        label: "พื้นที่เสี่ยงน้ำท่วม",
        value: formatNumber(data.databaseSummary?.riskVillages, 0),
        suffix: "หมู่บ้าน",
        detail: data.databaseSummary?.riskVillages != null ? `เฝ้าระวัง / เสี่ยงสูง · ${formatNumber(data.databaseSummary.riskHouseholds, 0)} ครัวเรือนตามทะเบียน` : "ยังอ่านทะเบียนความเสี่ยงหมู่บ้านไม่ได้",
        icon: Home,
        source: { label: "ทะเบียนหมู่บ้านในฐานข้อมูล · สถานะเฝ้าระวัง / เสี่ยงสูง", url: "/api/villages" },
        className: "from-[#ffb23b] to-[#ed7708]",
      },
      {
        label: "ศูนย์พักพิงเปิดดำเนินการ",
        value: formatNumber(data.databaseSummary?.openShelters, 0),
        suffix: "ศูนย์",
        detail: data.databaseSummary?.openShelters != null ? `ความจุตามทะเบียน ${formatNumber(data.databaseSummary.openShelterCapacity, 0)} คน · ไม่ใช่จำนวนที่ว่าง` : "ยังอ่านสถานะเปิดศูนย์พักพิงจากฐานข้อมูลไม่ได้",
        icon: Siren,
        source: { label: "ทะเบียนศูนย์พักพิงในฐานข้อมูล · สถานะเปิดใช้งาน", url: "/api/shelters" },
        className: "from-[#ff675e] to-[#e12624]",
      },
      {
        label: "ผู้ขอความช่วยเหลือที่ยืนยัน",
        value: formatNumber(data.databaseSummary?.confirmedHelpPeople, 0),
        suffix: "คน",
        detail: data.databaseSummary?.confirmedHelpReports != null ? `รวมจาก ${formatNumber(data.databaseSummary.confirmedHelpReports, 0)} รายงานที่ยังไม่ปิดงาน · ยอดอาจซ้ำระหว่างรายงาน` : "ยังอ่านรายงานขอความช่วยเหลือที่ยืนยันไม่ได้",
        icon: Users,
        source: { label: "รายงานขอความช่วยเหลือในฐานข้อมูล · ยืนยันแล้ว / กำลังดำเนินการ", url: "/api/reports" },
        className: "from-[#b387ea] to-[#7b4bd0]",
      },
    ],
    [highestRainStation, latestRealWaterLevel, currentRainSource, currentWaterSource, data.databaseSummary],
  );

  return (
    <div className="space-y-3">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className={`min-h-[108px] rounded-[8px] bg-gradient-to-br ${card.className} px-5 py-4 text-white shadow-sm`}>
            <div className="flex items-center gap-3">
              <card.icon className="size-9 shrink-0 text-white" strokeWidth={2.7} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white/90">{card.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[26px] font-extrabold leading-none">{card.value}</span>
                  <span className="text-sm font-extrabold">{card.suffix}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-white/85">{card.detail}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-white/25 pt-2">
              <DataSource {...card.source} inverse />
            </div>
          </article>
        ))}
      </section>

      <section>
        <Panel title="แผนที่ภูมิประเทศลุ่มน้ำป่าพะยอม" sources={[
          { label: "Esri · World Topographic Map", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer" },
          { label: "เส้นทางน้ำ · OpenStreetMap contributors (ชุดข้อมูลที่นำเข้าในระบบ)", url: "/terrain/pa-phayom-waterways.json" },
          { label: "ขอบเขตลุ่มน้ำป่าพะยอม · GeoJSON ที่ใช้ในระบบ", url: "/boundaries/pa-phayom-basin.geojson" },
          { label: "ทะเบียนสถานีตรวจวัดในฐานข้อมูล", url: "/api/sensor/devices" },
          { label: "ทะเบียนศูนย์อพยพในฐานข้อมูล", url: "/api/shelters" },
        ]}>
          <div ref={mapContainer} className="relative h-[calc(100dvh-148px)] min-h-[420px] overflow-hidden rounded-b-[8px] bg-slate-100 [&:fullscreen]:h-dvh [&:fullscreen]:min-h-0 [&:fullscreen]:rounded-none">
            {mapReady ? <BasinMap showWaterways={showWaterways} showStations={showStations} showShelters={showShelters} /> : <MapPlaceholder />}
            <button type="button" onClick={() => void toggleMapFullscreen()} className="absolute right-3 top-3 z-10 flex min-h-11 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-bold text-[#20325c] shadow-sm" aria-label={mapFullscreen ? "ออกจากแผนที่เต็มจอ" : "เปิดแผนที่เต็มจอ"}>
              {mapFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
              {mapFullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}
            </button>
            {fullscreenError && <p role="status" className="absolute right-3 top-16 z-10 max-w-[240px] rounded bg-white p-3 text-xs text-slate-700">เบราว์เซอร์นี้เปิดโหมดเต็มจอไม่ได้</p>}
            <details open className="absolute left-4 top-4 z-10 max-h-[calc(100%-80px)] w-[160px] overflow-y-auto rounded-[8px] bg-[#102130]/92 p-4 text-white shadow-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-extrabold">
                ชั้นข้อมูล
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="mt-3">
              <p className="text-[11px] font-bold">แผนที่ภูมิประเทศ</p>
              <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={showWaterways} onChange={(event) => setShowWaterways(event.target.checked)} className="size-4 accent-sky-400" />
                เส้นทางน้ำ
              </label>
              <div className="space-y-2 text-[11px]">
                <p className="flex items-center gap-2"><span className="w-5 border-t-[3px] border-[#56b5ff]" />แม่น้ำ / คลอง</p>
                <p className="flex items-center gap-2"><span className="w-5 border-t-2 border-[#6edaff]" />ทางน้ำย่อย</p>
              </div>
              <div className="mt-3 border-t border-white/20 pt-3 text-[11px] font-bold">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={showStations} onChange={(event) => setShowStations(event.target.checked)} className="size-4 shrink-0 accent-blue-400" />
                  สถานีตรวจวัด
                </label>
                <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={showShelters} onChange={(event) => setShowShelters(event.target.checked)} className="size-4 shrink-0 accent-green-400" />
                  ศูนย์อพยพ
                </label>
              </div>
              <div className="mt-3 border-t border-white/20 pt-3 text-[11px] font-bold">
                <span className="mb-1 block w-8 border-t-2 border-dashed border-[#7de0da]" />
                ขอบเขตลุ่มน้ำป่าพะยอม
                <p className="mt-1 font-normal text-white/75">พื้นที่นอกลุ่มน้ำแสดงสีเข้ม</p>
              </div>
              </div>
            </details>
          </div>
        </Panel>
      </section>

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3 xl:col-start-2 xl:row-start-1">
        <Panel title="ENSO · เอลนีโญและลานีญา" sources={[{ label: "ยังไม่ได้เชื่อมต่อแหล่งข้อมูล ENSO" }]}>
          <div className="flex flex-col gap-6 p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="size-2 rounded-full bg-slate-400" />
              ยังไม่มีข้อมูล ENSO ที่ยืนยันแล้ว
            </div>
            <div className="border-y border-slate-100 py-6">
              <Waves size={32} className="mb-3 text-[#5370a0]" aria-hidden="true" />
              <p className="text-base font-extrabold text-[#20325c]">รอข้อมูล ENSO</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                ติดตามภาวะเอลนีโญ ลานีญา และแนวโน้มภูมิอากาศ เพื่อประกอบการเฝ้าระวังน้ำท่วมและภัยแล้ง
              </p>
            </div>
            <dl className="space-y-3 text-xs">
              {["ภาวะ ENSO ล่าสุด", "แนวโน้มระยะถัดไป", "รอบรายงาน / แหล่งข้อมูล"].map((label) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="font-bold text-slate-600">{label}</dt>
                  <dd className="font-semibold text-slate-500">รอข้อมูล</dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>
        </div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <Panel title="ภาพวนซ้ำเรดาร์ฝน พัทลุง" sources={[{ label: "SEMET · ภาพวนซ้ำเรดาร์ฝนพัทลุง", url: rainLoopUrl }]}>
          <div className="relative h-[400px] overflow-hidden bg-slate-900 sm:h-[560px]">
            <Image
              src={rainLoopUrl}
              alt="ภาพวนซ้ำเรดาร์ฝนพื้นที่พัทลุง"
              fill
              unoptimized
              loading="lazy"
              sizes="(min-width: 1280px) 66vw, 100vw"
              className="object-contain"
            />
          </div>
        </Panel>
        </div>

        <div className="min-w-0 space-y-3 xl:col-span-2 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0">
        <Panel title="ระดับน้ำในลำน้ำสำคัญ" sources={[currentWaterSource]}>
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

        <Panel title="พยากรณ์อากาศ" sources={!situation ? [{ label: "กรมอุตุนิยมวิทยา · ภาคใต้ฝั่งตะวันออก", url: tmdForecastUrl }] : undefined}>
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
                      <div className="mt-2"><DataSource label={`กรมอุตุนิยมวิทยา · ${index === 0 ? "พยากรณ์ 24 ชั่วโมง" : "แนวโน้ม 7 วัน"}`} url={forecast.sourceUrl} /></div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                        <span className="rounded-[7px] bg-sky-100 px-2 py-1 text-sky-700">โอกาสฝน {forecast.probabilityPercent ?? "-"}</span>
                        <span className="rounded-[7px] bg-amber-100 px-2 py-1 text-amber-800">{forecast.heavyRainText ?? "ไม่พบคำฝนหนัก"}</span>
                      </div>
                    </div>
                  ))}
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
        </div>
      </section>

      <section className="grid gap-3 [contain-intrinsic-size:430px] [content-visibility:auto] md:grid-cols-2 xl:grid-cols-[1.1fr_0.72fr_0.86fr]">
        <Panel title={`ศูนย์อพยพที่เปิดดำเนินการ (${openShelters} แห่ง)`} action="ดูทั้งหมด" sources={[exampleSource, { label: "จำนวนศูนย์ตามทะเบียนในระบบ", url: "/api/dashboard" }]}>
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

        <Panel title="สถานการณ์โดยสรุป" sources={[exampleSource]}>
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

        <Panel title="ข่าวประชาสัมพันธ์" action="ดูทั้งหมด" sources={[exampleSource]}>
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
