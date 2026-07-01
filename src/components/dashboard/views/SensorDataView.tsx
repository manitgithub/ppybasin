"use client";

import { Activity, BatteryMedium, Clock3, Copy, Database, Droplets, Server, Thermometer, Wifi, Wind } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SensorReading } from "@/components/dashboard/types";
import { formatDate, sensorAgeLabel, toNumber } from "@/components/dashboard/utils";

const senderJson = `{
  "device_id": "WS001",
  "wind_speed": 1.10,
  "direction": "Northeast",
  "humidity": 50.40,
  "temperature": 27.40,
  "rainfall": 0.00,
  "water_level": 7.413,
  "battery_1": 11.05,
  "battery_2": 11.16
}`;

function optionalMetric(value: string | number | null, digits: number, unit = "") {
  if (value === null || typeof value === "undefined") {
    return "-";
  }

  const numeric = toNumber(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(digits)}${unit}` : "-";
}

function readingBattery(reading: SensorReading) {
  return reading.battery_1 ?? reading.battery;
}

export function SensorSenderGuide() {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const webhookUrl = `${origin || "https://your-domain.example"}/api/sensor`;
  const curlCommand = `curl -X POST ${webhookUrl} \\
  -H 'Content-Type: application/json' \\
  -d '${senderJson.replace(/\n/g, "")}'`;

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-[8px] border border-blue-100 bg-white shadow-lg shadow-slate-200/60">
      <div className="grid gap-0 xl:grid-cols-[330px_1fr]">
        <div className="bg-[#0f2746] p-5 text-white">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[8px] bg-white/12">
              <Server size={19} />
            </span>
            <div>
              <h3 className="text-base font-extrabold">วิธีส่งข้อมูลเข้า Server</h3>
              <p className="text-xs font-semibold text-blue-100">IoT Sender Setup</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-blue-200">Webhook URL</p>
              <button
                className="mt-1 flex w-full items-center justify-between gap-2 rounded-[8px] bg-white/10 px-3 py-2 text-left text-xs font-bold text-white"
                onClick={() => void copyText("url", webhookUrl)}
              >
                <span className="truncate">{webhookUrl}</span>
                <Copy size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[8px] bg-white/10 px-3 py-2">
                <p className="text-[11px] font-extrabold text-blue-200">Method</p>
                <p className="font-extrabold">POST</p>
              </div>
              <div className="rounded-[8px] bg-white/10 px-3 py-2">
                <p className="text-[11px] font-extrabold text-blue-200">Header</p>
                <p className="truncate font-extrabold">application/json</p>
              </div>
            </div>
            {copied && <p className="text-xs font-bold text-emerald-200">คัดลอกแล้ว: {copied}</p>}
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-800">JSON Body</p>
              <button
                className="inline-flex items-center gap-1 rounded-[8px] bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600 hover:bg-slate-200"
                onClick={() => void copyText("json", senderJson)}
              >
                <Copy size={14} />
                Copy
              </button>
            </div>
            <pre className="min-h-[190px] overflow-x-auto rounded-[8px] bg-slate-950 p-4 text-xs font-semibold leading-6 text-blue-50">
              <code>{senderJson}</code>
            </pre>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-800">ทดสอบด้วย curl</p>
              <button
                className="inline-flex items-center gap-1 rounded-[8px] bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600 hover:bg-slate-200"
                onClick={() => void copyText("curl", curlCommand)}
              >
                <Copy size={14} />
                Copy
              </button>
            </div>
            <pre className="min-h-[190px] overflow-x-auto rounded-[8px] bg-slate-100 p-4 text-xs font-bold leading-6 text-slate-700">
              <code>{curlCommand}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SensorDataView() {
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
    ? readings.reduce((sum, reading) => sum + toNumber(readingBattery(reading)), 0) / readings.length
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
      label: "ระดับน้ำล่าสุด",
      value: latest ? optionalMetric(latest.water_level, 3, " m") : "-",
      detail: latest ? `ฝนสะสม ${optionalMetric(latest.rainfall, 2, " mm")}` : "ยังไม่มีข้อมูล",
      icon: BatteryMedium,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "แบตเตอรี่เฉลี่ย",
      value: readings.length ? `${averageBattery.toFixed(2)}V` : "-",
      detail: "คำนวณจาก Battery 1 ของรายการที่โหลดล่าสุด",
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

      <SensorSenderGuide />

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
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Device</th>
                  <th className="px-5 py-3">Temperature</th>
                  <th className="px-5 py-3">Humidity</th>
                  <th className="px-5 py-3">Wind</th>
                  <th className="px-5 py-3">Direction</th>
                  <th className="px-5 py-3">Rainfall</th>
                  <th className="px-5 py-3">Water Level</th>
                  <th className="px-5 py-3">Battery 1</th>
                  <th className="px-5 py-3">Battery 2</th>
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
                    <td className="px-5 py-4 font-bold text-slate-700">{reading.direction ?? "-"}</td>
                    <td className="px-5 py-4 font-bold text-slate-700">{optionalMetric(reading.rainfall, 2, " mm")}</td>
                    <td className="px-5 py-4 font-bold text-slate-700">{optionalMetric(reading.water_level, 3, " m")}</td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-extrabold",
                          toNumber(readingBattery(reading)) >= 3.7
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {optionalMetric(readingBattery(reading), 2, "V")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-extrabold",
                          reading.battery_2 !== null && toNumber(reading.battery_2) >= 3.7
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {optionalMetric(reading.battery_2, 2, "V")}
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
