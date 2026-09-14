"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  CloudRain,
  Database,
  Droplets,
  ExternalLink,
  Gauge,
  Hospital,
  Info,
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
import type { ForecastPayload, ForecastSourceStatus } from "@/lib/forecast/adapters";
import type { SituationPayload, SourceStatus } from "@/lib/situation/adapters";
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
type EmergencyTone = "normal" | "watch" | "warning" | "critical" | "unknown";

const EvacuationMapView = dynamic(() => import("@/components/dashboard/views/EvacuationMapView"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[520px] place-items-center rounded-[8px] border border-slate-200 bg-white text-sm font-extrabold text-slate-500 shadow-sm">
      กำลังโหลดแผนที่และเส้นทางอพยพ...
    </div>
  ),
});

const statusText: Record<SourceStatus, string> = {
  ok: "พร้อมใช้",
  unavailable: "เรียกไม่ได้",
  schema_changed: "schema เปลี่ยน",
  no_confirmed_data: "ไม่มีข้อมูลยืนยัน",
};

const statusClassName: Record<SourceStatus, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  unavailable: "bg-rose-50 text-rose-700",
  schema_changed: "bg-amber-50 text-amber-700",
  no_confirmed_data: "bg-slate-100 text-slate-600",
};

const forecastStatusText: Record<ForecastSourceStatus, string> = {
  ok: "พร้อมใช้",
  unavailable: "เรียกไม่ได้",
  schema_changed: "schema เปลี่ยน",
  blocked_embed: "ฝังไม่ได้",
};

const forecastStatusClassName: Record<ForecastSourceStatus, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  unavailable: "bg-rose-50 text-rose-700",
  schema_changed: "bg-amber-50 text-amber-700",
  blocked_embed: "bg-sky-50 text-sky-700",
};

const emergencyTone = {
  normal: {
    label: "ปกติ",
    text: "text-emerald-800",
    mutedText: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
    bar: "bg-emerald-500",
  },
  watch: {
    label: "เฝ้าระวัง",
    text: "text-sky-800",
    mutedText: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    iconBg: "bg-sky-100",
    iconText: "text-sky-700",
    bar: "bg-sky-500",
  },
  warning: {
    label: "ควรจับตา",
    text: "text-amber-900",
    mutedText: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconText: "text-amber-800",
    bar: "bg-amber-500",
  },
  critical: {
    label: "วิกฤต",
    text: "text-rose-900",
    mutedText: "text-rose-800",
    bg: "bg-rose-50",
    border: "border-rose-200",
    iconBg: "bg-rose-100",
    iconText: "text-rose-800",
    bar: "bg-rose-600",
  },
  unknown: {
    label: "รอยืนยัน",
    text: "text-slate-800",
    mutedText: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
    bar: "bg-slate-400",
  },
} satisfies Record<EmergencyTone, Record<string, string>>;

function formatNumber(value: number | null | undefined, digits = 1) {
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

function formatThaiMonthYear(year: number, month: number) {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "short",
    year: "numeric",
  }).format(date);
}

function StatusBadge({ status }: { status: SourceStatus }) {
  return <span className={`rounded-[7px] px-2 py-1 text-[11px] font-extrabold ${statusClassName[status]}`}>{statusText[status]}</span>;
}

function ForecastStatusBadge({ status }: { status: ForecastSourceStatus }) {
  return <span className={`rounded-[7px] px-2 py-1 text-[11px] font-extrabold ${forecastStatusClassName[status]}`}>{forecastStatusText[status]}</span>;
}

function toneForRainfall(rainfallMm: number, durationHours: 24 | 72): EmergencyTone {
  const critical = durationHours === 24 ? 90 : 180;
  const warning = durationHours === 24 ? 50 : 120;
  const watch = durationHours === 24 ? 20 : 70;

  if (rainfallMm >= critical) return "critical";
  if (rainfallMm >= warning) return "warning";
  if (rainfallMm >= watch) return "watch";
  return "normal";
}

function toneForWaterLevel(situationLevel: number | null | undefined): EmergencyTone {
  if (typeof situationLevel !== "number") return "unknown";
  if (situationLevel >= 4) return "critical";
  if (situationLevel >= 3) return "warning";
  if (situationLevel >= 2) return "watch";
  return "normal";
}

function toneForReservoirPercent(percent: number | null | undefined): EmergencyTone {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return "unknown";
  if (percent >= 95) return "critical";
  if (percent >= 80) return "warning";
  if (percent >= 60) return "watch";
  return "normal";
}

function toneForSourceProblems(count: number): EmergencyTone {
  if (count >= 3) return "critical";
  if (count >= 1) return "warning";
  return "normal";
}

function toneForForecastText(probabilityPercent: string | null, heavyRainText: string | null): EmergencyTone {
  if (heavyRainText?.includes("หนักมาก")) return "critical";
  if (heavyRainText?.includes("หนัก")) return "warning";
  const maxProbability = probabilityPercent
    ?.match(/\d{1,3}/g)
    ?.map(Number)
    .reduce((max, value) => Math.max(max, value), 0);

  if (!maxProbability) return "unknown";
  if (maxProbability >= 80) return "warning";
  if (maxProbability >= 60) return "watch";
  return "normal";
}

function toneForNoticeStatus(status: SourceStatus): EmergencyTone {
  if (status === "unavailable" || status === "schema_changed") return "warning";
  if (status === "ok") return "watch";
  return "unknown";
}

function SeverityBadge({ tone }: { tone: EmergencyTone }) {
  const toneStyle = emergencyTone[tone];
  const Icon = tone === "critical" || tone === "warning" ? CircleAlert : tone === "normal" ? CircleCheck : Info;

  return (
    <span className={`inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[11px] font-extrabold ${toneStyle.bg} ${toneStyle.mutedText}`}>
      <Icon size={13} />
      {toneStyle.label}
    </span>
  );
}

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

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "unknown",
}: {
  label: string;
  value: string;
  detail: string;
  icon?: typeof Waves;
  tone?: EmergencyTone;
}) {
  const toneStyle = emergencyTone[tone];

  return (
    <article className={`rounded-[8px] border p-5 shadow-sm ${Icon ? `${toneStyle.border} ${toneStyle.bg}` : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-xs font-extrabold ${Icon ? toneStyle.mutedText : "text-slate-500"}`}>{label}</p>
        {Icon ? (
          <span className={`grid size-9 shrink-0 place-items-center rounded-[8px] ${toneStyle.iconBg} ${toneStyle.iconText}`}>
            <Icon size={18} />
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-3xl font-extrabold ${Icon ? toneStyle.text : "text-[#20325c]"}`}>{value}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold ${Icon ? toneStyle.mutedText : "text-slate-500"}`}>{detail}</p>
        {Icon ? <SeverityBadge tone={tone} /> : null}
      </div>
    </article>
  );
}

function TrackingSituationView({ data }: { data: DashboardPayload }) {
  const [situation, setSituation] = useState<SituationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/situation", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SituationPayload>;
      })
      .then((payload) => {
        setSituation(payload);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "โหลดข้อมูลสถานการณ์ไม่สำเร็จ");
      });

    return () => controller.abort();
  }, []);

  const rain24Max = situation?.thaiWater.rain24h.reduce((max, station) => Math.max(max, station.rainfallMm), 0) ?? data.summary.rainfall24h;
  const rain72Max = situation?.thaiWater.rain72h.reduce((max, station) => Math.max(max, station.rainfallMm), 0) ?? 0;
  const latestWaterLevel = situation?.thaiWater.waterLevels.find((station) => station.waterLevelMsl !== null) ?? null;
  const sourceProblems = situation?.sources.filter((source) => source.status !== "ok").length ?? 0;
  const rain24Tone = toneForRainfall(rain24Max, 24);
  const rain72Tone = toneForRainfall(rain72Max, 72);
  const waterTone = toneForWaterLevel(latestWaterLevel?.situationLevel);
  const sourceTone = toneForSourceProblems(sourceProblems);

  if (error) {
    return (
      <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
        โหลดข้อมูลติดตามสถานการณ์ไม่สำเร็จ: {error}
      </div>
    );
  }

  if (!situation) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-[8px] border border-slate-200 bg-white text-sm font-extrabold text-slate-500 shadow-sm">
        กำลังตรวจสอบข้อมูลสถานการณ์จาก ThaiWater, TMD, RID, ปภ. และ GISTDA...
      </div>
    );
  }

  const topRain24 = [...situation.thaiWater.rain24h].sort((a, b) => b.rainfallMm - a.rainfallMm).slice(0, 5);
  const topRain72 = [...situation.thaiWater.rain72h].sort((a, b) => b.rainfallMm - a.rainfallMm).slice(0, 5);
  const waterRows = situation.thaiWater.waterLevels.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="ฝนสูงสุด 24 ชม."
          value={`${formatNumber(rain24Max)} มม.`}
          detail={`${situation.thaiWater.rain24h.length.toLocaleString("th-TH")} สถานีในจังหวัดพัทลุง`}
          icon={CloudRain}
          tone={rain24Tone}
        />
        <MetricCard
          label="ฝนสูงสุด 72 ชม."
          value={`${formatNumber(rain72Max)} มม.`}
          detail={`${situation.thaiWater.rain72h.length.toLocaleString("th-TH")} สถานีที่ยืนยัน schema ได้`}
          icon={Droplets}
          tone={rain72Tone}
        />
        <MetricCard
          label="ระดับน้ำล่าสุด"
          value={latestWaterLevel ? `${formatNumber(latestWaterLevel.waterLevelMsl, 2)} ม.รทก.` : `${data.summary.latestWaterLevel.toFixed(2)} ม.`}
          detail={latestWaterLevel ? `${latestWaterLevel.name} ${formatDateTime(latestWaterLevel.observedAt)}` : "ยังไม่มีระดับน้ำจาก ThaiWater ที่ยืนยันได้"}
          icon={Gauge}
          tone={waterTone}
        />
        <MetricCard
          label="แหล่งข้อมูลที่ต้องตรวจ"
          value={sourceProblems.toLocaleString("th-TH")}
          detail={`อัปเดต ${formatDateTime(situation.updatedAt)}`}
          icon={RadioTower}
          tone={sourceTone}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <span className="grid size-10 place-items-center rounded-[8px] bg-blue-50 text-blue-700">
              <Waves size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">ThaiWater/สสน. ฝนและระดับน้ำ</h3>
              <p className="text-xs font-semibold text-slate-500">ใช้ข้อมูลจังหวัดพัทลุงจาก API v3 และแสดงเฉพาะ field ที่ parser ยืนยันได้</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-extrabold text-slate-500">ฝน 24 ชั่วโมงสูงสุด</p>
              <div className="space-y-2">
                {topRain24.map((station) => {
                  const stationTone = toneForRainfall(station.rainfallMm, 24);
                  const toneStyle = emergencyTone[stationTone];

                  return (
                    <div key={`rain24-${station.id}`} className={`flex items-center justify-between gap-3 rounded-[8px] border px-4 py-3 ${toneStyle.border} ${toneStyle.bg}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-[7px] ${toneStyle.iconBg} ${toneStyle.iconText}`}>
                          <CloudRain size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-extrabold ${toneStyle.text}`}>{station.name}</span>
                          <span className={`text-xs font-semibold ${toneStyle.mutedText}`}>{station.district} • {formatDateTime(station.observedAt)}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <SeverityBadge tone={stationTone} />
                        <span className={`text-sm font-extrabold ${toneStyle.text}`}>{formatNumber(station.rainfallMm)} มม.</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-extrabold text-slate-500">ฝน 72 ชั่วโมงสูงสุด</p>
              <div className="space-y-2">
                {topRain72.map((station) => {
                  const stationTone = toneForRainfall(station.rainfallMm, 72);
                  const toneStyle = emergencyTone[stationTone];

                  return (
                    <div key={`rain72-${station.id}`} className={`flex items-center justify-between gap-3 rounded-[8px] border px-4 py-3 ${toneStyle.border} ${toneStyle.bg}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-[7px] ${toneStyle.iconBg} ${toneStyle.iconText}`}>
                          <Droplets size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-extrabold ${toneStyle.text}`}>{station.name}</span>
                          <span className={`text-xs font-semibold ${toneStyle.mutedText}`}>{station.district} • {formatDateTime(station.observedAt)}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <SeverityBadge tone={stationTone} />
                        <span className={`text-sm font-extrabold ${toneStyle.text}`}>{formatNumber(station.rainfallMm)} มม.</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="mb-3 text-xs font-extrabold text-slate-500">สถานีระดับน้ำ</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">สถานี</th>
                    <th className="px-4 py-3">ลำน้ำ</th>
                    <th className="px-4 py-3 text-right">ระดับ ม.รทก.</th>
                    <th className="px-4 py-3">ระดับฉุกเฉิน</th>
                    <th className="px-4 py-3">สถานะตลิ่ง</th>
                    <th className="px-4 py-3">เวลา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waterRows.map((station) => {
                    const stationTone = toneForWaterLevel(station.situationLevel);
                    const toneStyle = emergencyTone[stationTone];

                    return (
                      <tr key={station.id} className={stationTone === "critical" || stationTone === "warning" ? toneStyle.bg : undefined}>
                        <td className={`px-4 py-3 font-extrabold ${toneStyle.text}`}>
                          <span className="flex items-center gap-2">
                            <span className={`grid size-7 shrink-0 place-items-center rounded-[7px] ${toneStyle.iconBg} ${toneStyle.iconText}`}>
                              <Gauge size={15} />
                            </span>
                            {station.name}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${toneStyle.mutedText}`}>{station.river}</td>
                        <td className={`px-4 py-3 text-right font-extrabold ${toneStyle.text}`}>{formatNumber(station.waterLevelMsl, 2)}</td>
                        <td className="px-4 py-3">
                          <SeverityBadge tone={stationTone} />
                        </td>
                        <td className={`px-4 py-3 font-semibold ${toneStyle.mutedText}`}>{station.bankText ?? "-"}</td>
                        <td className={`px-4 py-3 font-semibold ${toneStyle.mutedText}`}>{formatDateTime(station.observedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">เรดาร์ฝน</h3>
                <p className="text-xs font-semibold text-slate-500">ThaiWater/สสน. จังหวัดพัทลุง</p>
              </div>
              <StatusBadge status={situation.thaiWater.radar ? "ok" : "schema_changed"} />
            </div>
            <p className="text-2xl font-extrabold text-[#20325c]">{situation.thaiWater.radar?.name ?? "ไม่พบข้อมูลเรดาร์"}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {situation.thaiWater.radar ? `${situation.thaiWater.radar.fileName} • ${formatDateTime(situation.thaiWater.radar.observedAt)}` : "parser ไม่สามารถยืนยัน field ภาพเรดาร์ได้"}
            </p>
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            {(() => {
              const reservoirTone = toneForReservoirPercent(situation.reservoir.capacityPercent);
              const toneStyle = emergencyTone[reservoirTone];
              const reservoirPercent = Math.min(Math.max(situation.reservoir.capacityPercent ?? 0, 0), 100);

              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-[8px] ${toneStyle.iconBg} ${toneStyle.iconText}`}>
                        <Gauge size={20} />
                      </span>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">อ่างเก็บน้ำป่าพะยอม</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{situation.reservoir.message}</p>
                      </div>
                    </div>
                    <SeverityBadge tone={reservoirTone} />
                  </div>

                  <div className={`mt-4 rounded-[8px] border p-4 ${toneStyle.border} ${toneStyle.bg}`}>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className={`text-xs font-extrabold ${toneStyle.mutedText}`}>ร้อยละความจุอ่าง</p>
                        <p className={`mt-1 text-4xl font-extrabold leading-none ${toneStyle.text}`}>
                          {formatNumber(situation.reservoir.capacityPercent, 1)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${toneStyle.mutedText}`}>ปริมาตรน้ำ / ความจุ รนก.</p>
                        <p className={`mt-1 text-sm font-extrabold ${toneStyle.text}`}>
                          {formatNumber(situation.reservoir.storageMcm, 3)} / {formatNumber(situation.reservoir.normalCapacityMcm, 3)} ล้าน ลบ.ม.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                      <div className={`h-full rounded-full ${toneStyle.bar}`} style={{ width: `${reservoirPercent}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-4 text-[10px] font-extrabold text-slate-500">
                      <span>0%</span>
                      <span className="text-center">60%</span>
                      <span className="text-center">80%</span>
                      <span className="text-right">100%</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="rounded-[7px] bg-emerald-100 px-2 py-1 text-emerald-700">ต่ำกว่า 60 ปกติ</span>
                      <span className="rounded-[7px] bg-sky-100 px-2 py-1 text-sky-700">60-79 เฝ้าระวัง</span>
                      <span className="rounded-[7px] bg-amber-100 px-2 py-1 text-amber-800">80-94 ควรจับตา</span>
                      <span className="rounded-[7px] bg-rose-100 px-2 py-1 text-rose-800">95+ วิกฤต</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MetricCard label="พื้นที่ว่างถึง รนก." value={`${formatNumber(situation.reservoir.emptyToNormalMcm, 3)} ล้าน ลบ.ม.`} detail="ความจุปกติ - ปริมาตรน้ำ" icon={Droplets} tone={reservoirTone} />
                    <MetricCard label="ปริมาตรใช้การได้" value={`${formatNumber(situation.reservoir.usableStorageMcm, 3)} ล้าน ลบ.ม.`} detail={`ข้อมูลจริง ${situation.reservoir.latestDataDate ?? "-"}`} icon={Gauge} tone={reservoirTone} />
                    <MetricCard label="น้ำไหลเข้า" value={`${formatNumber(situation.reservoir.inflowMcm, 3)} ล้าน ลบ.ม.`} detail="ไม่ใช้แทนคำว่าทรงตัว" />
                    <MetricCard label="น้ำระบาย" value={`${formatNumber(situation.reservoir.outflowMcm, 3)} ล้าน ลบ.ม.`} detail={`balance ${formatNumber(situation.reservoir.balanceCheckMcm, 3)}`} />
                  </div>
                </>
              );
            })()}
            </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {[situation.tmd.daily, situation.tmd.sevenDay].map((forecast, index) => {
          const forecastTone = toneForForecastText(forecast.probabilityPercent, forecast.heavyRainText);
          const toneStyle = emergencyTone[forecastTone];

          return (
            <section key={forecast.sourceUrl} className={`rounded-[8px] border p-5 shadow-sm ${toneStyle.border} ${toneStyle.bg}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-[8px] ${toneStyle.iconBg} ${toneStyle.iconText}`}>
                    <AlertTriangle size={20} />
                  </span>
                  <div>
                    <h3 className={`text-base font-extrabold ${toneStyle.text}`}>{index === 0 ? "TMD พยากรณ์ 24 ชั่วโมง" : "TMD แนวโน้ม 7 วัน"}</h3>
                    <p className={`text-xs font-semibold ${toneStyle.mutedText}`}>แยกโอกาสเกิดฝนออกจากข้อความฝนหนัก</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={forecast.status} />
                  <SeverityBadge tone={forecastTone} />
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3 rounded-[8px] bg-white/70 px-4 py-3">
                  <span className={`font-bold ${toneStyle.mutedText}`}>โอกาสเกิดฝน</span>
                  <span className={`font-extrabold ${toneStyle.text}`}>{forecast.probabilityPercent ?? "-"}</span>
                </div>
                <div className="flex justify-between gap-3 rounded-[8px] bg-white/70 px-4 py-3">
                  <span className={`font-bold ${toneStyle.mutedText}`}>คำฝนหนัก</span>
                  <span className={`font-extrabold ${toneStyle.text}`}>{forecast.heavyRainText ?? "ไม่พบในข้อความที่อ่านได้"}</span>
                </div>
                <p className={`text-xs font-semibold ${toneStyle.mutedText}`}>{forecast.mentionsPhatthalungDirectly ? "ระบุพัทลุงโดยตรงในข้อความฝนหนัก" : "เป็นข้อมูลระดับภูมิภาคหรือไม่ได้ระบุพัทลุงโดยตรง"}</p>
                <p className="rounded-[8px] bg-white/70 px-4 py-3 text-xs font-semibold text-slate-700">{forecast.evidence}</p>
              </div>
            </section>
          );
        })}

        <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[8px] bg-slate-100 text-slate-700">
              <Map size={20} />
            </span>
            <h3 className="text-base font-extrabold text-slate-800">ประกาศและพื้นที่น้ำท่วม</h3>
          </div>
          <div className="mt-4 space-y-3">
            {[situation.disaster.central, situation.disaster.phatthalung, situation.disaster.gistdaFloodBoundary].map((notice) => {
              const noticeTone = toneForNoticeStatus(notice.status);
              const toneStyle = emergencyTone[noticeTone];

              return (
                <div key={notice.sourceUrl} className={`rounded-[8px] border px-4 py-3 ${toneStyle.border} ${toneStyle.bg}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <a className={`truncate text-xs font-extrabold ${toneStyle.mutedText}`} href={notice.sourceUrl} target="_blank" rel="noreferrer">
                      {notice.sourceUrl}
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <SeverityBadge tone={noticeTone} />
                      <StatusBadge status={notice.status} />
                    </div>
                  </div>
                  <p className={`text-xs font-semibold ${toneStyle.mutedText}`}>{notice.message}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="grid size-10 place-items-center rounded-[8px] bg-slate-100 text-slate-700">
            <Database size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">สถานะแหล่งข้อมูล</h3>
            <p className="text-xs font-semibold text-slate-500">URL และ parser แยกตาม adapter เพื่อให้ปรับแต่ละแหล่งได้โดยไม่กระทบส่วนอื่น</p>
          </div>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {situation.sources.map((source) => (
            <div key={source.id} className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-extrabold text-slate-800">{source.label}</p>
                <StatusBadge status={source.status} />
              </div>
              <p className="line-clamp-2 text-xs font-semibold text-slate-500">{source.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ForecastView() {
  const [forecast, setForecast] = useState<ForecastPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/forecast", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ForecastPayload>;
      })
      .then((payload) => {
        setForecast(payload);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "โหลดข้อมูลคาดการณ์ไม่สำเร็จ");
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
        โหลดข้อมูลคาดการณ์ไม่สำเร็จ: {error}
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-[8px] border border-slate-200 bg-white text-sm font-extrabold text-slate-500 shadow-sm">
        กำลังโหลดฝนคาดการณ์ 6 เดือนของ สสน. และตรวจสถานะ CLPP radar...
      </div>
    );
  }

  const rainfall = forecast.hiiRainfall;
  const records = rainfall?.records ?? [];
  const maxRainfall = Math.max(...records.map((record) => record.rainfallMm), 1);
  const chartWidth = 620;
  const chartHeight = 260;
  const chartPaddingX = 34;
  const chartTop = 26;
  const chartBottom = 206;
  const chartSpanX = chartWidth - chartPaddingX * 2;
  const chartSpanY = chartBottom - chartTop;
  const chartPoints = records.map((record, index) => {
    const x = chartPaddingX + (records.length <= 1 ? 0 : (index / (records.length - 1)) * chartSpanX);
    const y = chartBottom - (record.rainfallMm / maxRainfall) * chartSpanY;
    return { record, x, y };
  });
  const trendPath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const trendAreaPath = chartPoints.length
    ? `${trendPath} L ${chartPoints.at(-1)?.x.toFixed(1)} ${chartBottom} L ${chartPoints[0].x.toFixed(1)} ${chartBottom} Z`
    : "";
  const trendChange =
    records.length >= 2
      ? records[records.length - 1].rainfallMm - records[0].rainfallMm
      : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="รอบคาดการณ์"
          value={rainfall ? formatThaiMonthYear(rainfall.initialYear, rainfall.initialMonth) : "-"}
          detail="ข้อมูลปี 2569 จังหวัดพัทลุง"
        />
        <MetricCard
          label="ฝนรวม 6 เดือน"
          value={`${formatNumber(rainfall?.totalRainfallMm, 1)} มม.`}
          detail={rainfall?.trendText ?? "รอข้อมูลจาก สสน."}
        />
        <MetricCard
          label="เดือนฝนสูงสุด"
          value={rainfall?.wettestMonth ? `${formatNumber(rainfall.wettestMonth.rainfallMm, 1)} มม.` : "-"}
          detail={rainfall?.wettestMonth ? formatThaiMonthYear(rainfall.wettestMonth.forecastYear, rainfall.wettestMonth.forecastMonth) : "-"}
        />
        <MetricCard
          label="ฝนเฉลี่ยต่อเดือน"
          value={`${formatNumber(rainfall?.averageRainfallMm, 1)} มม.`}
          detail={`อัปเดต ${formatDateTime(forecast.updatedAt)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-[8px] bg-sky-50 text-sky-700">
                <CloudRain size={20} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">ฝนคาดการณ์ 6 เดือน รายจังหวัด</h3>
                <p className="text-xs font-semibold text-slate-500">สสน. CKAN datastore, จังหวัดพัทลุง, ปี 2569</p>
              </div>
            </div>
            {forecast.sources[0] && <ForecastStatusBadge status={forecast.sources[0].status} />}
          </div>

          {rainfall ? (
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-slate-500">แนวโน้มจากเดือนแรกถึงเดือนสุดท้าย</p>
                  <p className={trendChange >= 0 ? "mt-1 text-sm font-extrabold text-amber-800" : "mt-1 text-sm font-extrabold text-emerald-700"}>
                    {trendChange >= 0 ? "เพิ่มขึ้น" : "ลดลง"} {formatNumber(Math.abs(trendChange), 1)} มม.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-[7px] bg-[#e4f3f5] px-2 py-1 text-[#1f7a8c]">เส้นแนวโน้ม</span>
                  <span className="rounded-[7px] bg-amber-100 px-2 py-1 text-amber-800">จุดสูงสุด</span>
                  <span className="rounded-[7px] bg-emerald-100 px-2 py-1 text-emerald-700">จุดต่ำสุด</span>
                </div>
              </div>

              <div className="overflow-x-auto border-b border-slate-200 pb-4">
                <svg className="min-w-[620px]" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="กราฟแนวโน้มฝนคาดการณ์ 6 เดือน จังหวัดพัทลุง">
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = chartBottom - ratio * chartSpanY;
                    return (
                      <g key={ratio}>
                        <line x1={chartPaddingX} x2={chartWidth - chartPaddingX} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                        <text x={chartPaddingX - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-bold">
                          {formatNumber(maxRainfall * ratio, 0)}
                        </text>
                      </g>
                    );
                  })}

                  {chartPoints.map((point, index) => {
                    const barWidth = 38;
                    const barHeight = chartBottom - point.y;
                    const isWettest = rainfall.wettestMonth?.id === point.record.id;
                    const isDriest = rainfall.driestMonth?.id === point.record.id;

                    return (
                      <g key={`bar-${point.record.id}`}>
                        <rect
                          x={point.x - barWidth / 2}
                          y={point.y}
                          width={barWidth}
                          height={barHeight}
                          rx="6"
                          className={isWettest ? "fill-amber-200" : isDriest ? "fill-emerald-100" : "fill-sky-100"}
                        />
                        <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-slate-700 text-[11px] font-extrabold">
                          {formatNumber(point.record.rainfallMm, 0)}
                        </text>
                        <text x={point.x} y={236} textAnchor="middle" className="fill-slate-500 text-[10px] font-bold">
                          {formatThaiMonthYear(point.record.forecastYear, point.record.forecastMonth)}
                        </text>
                        <text x={point.x} y={252} textAnchor="middle" className="fill-slate-400 text-[10px] font-bold">
                          {index + 1}
                        </text>
                      </g>
                    );
                  })}

                  {trendAreaPath ? <path d={trendAreaPath} fill="#55a3b4" opacity="0.12" /> : null}
                  {trendPath ? <path d={trendPath} fill="none" stroke="#1f7a8c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}

                  {chartPoints.map((point) => {
                    const isWettest = rainfall.wettestMonth?.id === point.record.id;
                    const isDriest = rainfall.driestMonth?.id === point.record.id;
                    return (
                      <g key={`point-${point.record.id}`}>
                        <circle cx={point.x} cy={point.y} r={isWettest || isDriest ? 8 : 6} className={isWettest ? "fill-amber-500" : isDriest ? "fill-emerald-500" : "fill-[#1f7a8c]"} />
                        <circle cx={point.x} cy={point.y} r={isWettest || isDriest ? 13 : 10} fill="none" className={isWettest ? "stroke-amber-200" : isDriest ? "stroke-emerald-200" : "stroke-[#b8dee5]"} strokeWidth="3" />
                      </g>
                    );
                  })}
                </svg>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                หน่วยเป็นมิลลิเมตรต่อเดือน ใช้เพื่อดูแนวโน้มอนาคต ไม่ใช่ปริมาณฝนรายวันหรือระดับเตือนภัยทันที
              </p>
            </div>
          ) : (
            <div className="p-5 text-sm font-bold text-amber-700">ไม่พบข้อมูลฝนคาดการณ์ที่ parser ยืนยันได้</div>
          )}
        </section>

        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">CLPP Radar / Nowcasting</h3>
              <p className="text-xs font-semibold text-slate-500">เครื่องมือ radar composite ของ ONWR</p>
            </div>
            <ForecastStatusBadge status={forecast.clppRadar.status} />
          </div>
          <div className="p-5">
            <div className="rounded-[8px] border border-slate-200 bg-[#0d1117] p-5 text-white">
              <p className="text-xs font-extrabold text-sky-200">{forecast.clppRadar.title}</p>
              <p className="mt-3 text-sm font-semibold text-slate-200">{forecast.clppRadar.message}</p>
              <a
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-500 px-4 text-sm font-extrabold text-white transition hover:bg-sky-400"
                href={forecast.clppRadar.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={17} />
                เปิดหน้า CLPP Radar
              </a>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              ถ้าหน้านี้ตั้งค่า `x-frame-options` ห้ามฝัง ระบบจะเปิดเป็น tab ใหม่แทน เพื่อให้ใช้งานแผนที่และปุ่มควบคุมได้ครบ
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-extrabold text-slate-800">ตารางฝนคาดการณ์</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
                <tr>
                  <th className="px-5 py-3">เดือนคาดการณ์</th>
                  <th className="px-5 py-3">จังหวัด</th>
                  <th className="px-5 py-3 text-right">ปริมาณฝน</th>
                  <th className="px-5 py-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={`table-${record.id}`}>
                    <td className="px-5 py-4 font-extrabold text-slate-800">{formatThaiMonthYear(record.forecastYear, record.forecastMonth)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-500">{record.provinceNameTh}</td>
                    <td className="px-5 py-4 text-right font-extrabold text-slate-800">{formatNumber(record.rainfallMm, 2)} มม.</td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                      {rainfall?.wettestMonth?.id === record.id ? "สูงสุดในรอบนี้" : rainfall?.driestMonth?.id === record.id ? "ต่ำสุดในรอบนี้" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
            <span className="grid size-10 place-items-center rounded-[8px] bg-slate-100 text-slate-700">
              <Database size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">แหล่งข้อมูล</h3>
              <p className="text-xs font-semibold text-slate-500">แยก source สำหรับแก้ API/parser ภายหลัง</p>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {forecast.sources.map((source) => (
              <div key={source.id} className="rounded-[8px] bg-slate-50 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-extrabold text-slate-800">{source.label}</p>
                  <ForecastStatusBadge status={source.status} />
                </div>
                <p className="text-xs font-semibold text-slate-500">{source.message}</p>
                <a className="mt-2 block truncate text-xs font-extrabold text-blue-700" href={source.url} target="_blank" rel="noreferrer">
                  {source.url}
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>
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
      ) : viewId === "tracking" ? (
        <TrackingSituationView data={data} />
      ) : viewId === "forecast" ? (
        <ForecastView />
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
