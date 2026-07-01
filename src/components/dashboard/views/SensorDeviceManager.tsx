"use client";

import dynamic from "next/dynamic";
import { BookOpen, PlusCircle, Save, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SensorDevice, SensorDeviceForm } from "@/components/dashboard/types";
import { sensorAgeLabel } from "@/components/dashboard/utils";
import { SensorSenderGuide } from "@/components/dashboard/views/SensorDataView";

const ShelterLocationPicker = dynamic(() => import("@/components/dashboard/ShelterLocationPicker"), {
  ssr: false,
  loading: () => <div className="grid h-[330px] place-items-center rounded-[8px] border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">กำลังโหลดแผนที่...</div>,
});

function emptyDeviceForm(): SensorDeviceForm {
  return {
    device_id: "",
    name: "",
    location_name: "",
    latitude: "",
    longitude: "",
    status: "active",
  };
}

export default function SensorDeviceManager() {
  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [form, setForm] = useState<SensorDeviceForm>(emptyDeviceForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/sensor/devices", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "โหลดสถานีไม่สำเร็จ");
      }

      setDevices(payload.devices ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดสถานีไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDevices(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDevices]);

  const setField = (key: keyof SensorDeviceForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }) as SensorDeviceForm);
  };

  const setPosition = (position: { lat: number; lng: number }) => {
    setForm((current) => ({
      ...current,
      latitude: position.lat.toFixed(6),
      longitude: position.lng.toFixed(6),
    }));
  };

  const editDevice = (device: SensorDevice) => {
    setForm({
      device_id: device.device_id,
      name: device.name ?? "",
      location_name: device.location_name ?? "",
      latitude: device.latitude === null ? "" : String(device.latitude),
      longitude: device.longitude === null ? "" : String(device.longitude),
      status: device.status,
    });
  };

  const saveDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/sensor/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.details?.join(", ") ?? payload.error ?? "บันทึกสถานีไม่สำเร็จ");
      }

      setMessage(`บันทึกสถานี ${payload.device_id} แล้ว`);
      setForm(emptyDeviceForm());
      await loadDevices();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกสถานีไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = devices.filter((device) => device.status === "active").length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 md:text-3xl">สถานีตรวจวัด</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            เพิ่มหรือแก้ไขรหัสอุปกรณ์ ตำแหน่งติดตั้ง สถานะ และใช้ติดตามจำนวน readings ของแต่ละสถานี
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={[
              "inline-flex h-10 items-center gap-2 rounded-[8px] px-4 text-xs font-extrabold shadow-sm transition",
              guideOpen
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "bg-[#0879df] text-white shadow-blue-200 hover:bg-[#076bc5]",
            ].join(" ")}
            onClick={() => setGuideOpen((current) => !current)}
          >
            {guideOpen ? <X size={15} /> : <BookOpen size={15} />}
            {guideOpen ? "ปิดวิธีส่งข้อมูล" : "อ่านวิธีส่งข้อมูลเข้า Server"}
          </button>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
            ทั้งหมด {devices.length.toLocaleString("th-TH")} สถานี / active {activeCount.toLocaleString("th-TH")}
          </span>
        </div>
      </div>

      {guideOpen && <SensorSenderGuide />}

      {(error || message) && (
        <div
          className={[
            "rounded-[8px] border px-5 py-4 text-sm font-semibold",
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {error ?? message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60" onSubmit={saveDevice}>
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[8px] bg-blue-50 text-blue-700">
              <PlusCircle size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">เพิ่ม / แก้ไขสถานี</h3>
              <p className="text-xs font-medium text-slate-500">ใช้ device_id เดิมเพื่อแก้ไขข้อมูล</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-extrabold text-slate-500">Device ID</span>
              <input
                className="mt-1 h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold uppercase outline-none focus:border-blue-400"
                placeholder="WS007"
                value={form.device_id}
                onChange={(event) => setField("device_id", event.target.value.toUpperCase())}
              />
            </label>
            <label className="block">
              <span className="text-xs font-extrabold text-slate-500">ชื่อสถานี</span>
              <input
                className="mt-1 h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-400"
                placeholder="สถานีอากาศ..."
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-extrabold text-slate-500">พื้นที่ติดตั้ง</span>
              <input
                className="mt-1 h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-400"
                placeholder="บ้าน / คลอง / ศูนย์ประสานงาน"
                value={form.location_name}
                onChange={(event) => setField("location_name", event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-extrabold text-slate-500">Latitude</span>
                <input
                  className="mt-1 h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-400"
                  placeholder="7.7899"
                  value={form.latitude}
                  onChange={(event) => setField("latitude", event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold text-slate-500">Longitude</span>
                <input
                  className="mt-1 h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-400"
                  placeholder="100.2065"
                  value={form.longitude}
                  onChange={(event) => setField("longitude", event.target.value)}
                />
              </label>
            </div>
            <div>
              <span className="mb-2 block text-xs font-extrabold text-slate-500">ตำแหน่งสถานีบนแผนที่</span>
              <ShelterLocationPicker
                lat={form.latitude}
                lng={form.longitude}
                markerLabel="●"
                helperText="คลิกบนแผนที่หรือเลื่อนหมุดเพื่อกำหนดพิกัดสถานีตรวจวัด"
                onChange={setPosition}
              />
            </div>
            <label className="block">
              <span className="text-xs font-extrabold text-slate-500">สถานะ</span>
              <select
                className="mt-1 h-11 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400"
                value={form.status}
                onChange={(event) => setField("status", event.target.value as SensorDeviceForm["status"])}
              >
                <option value="active">active</option>
                <option value="maintenance">maintenance</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#0879df] px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-[#076bc5] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
            >
              <Save size={17} />
              {saving ? "กำลังบันทึก" : "บันทึกสถานี"}
            </button>
            <button
              type="button"
              className="h-11 rounded-[8px] border border-slate-200 px-4 text-sm font-extrabold text-slate-600 hover:bg-slate-50"
              onClick={() => setForm(emptyDeviceForm())}
            >
              ล้าง
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">รายการสถานีเซ็นเซอร์</h3>
              <p className="text-xs font-medium text-slate-500">ข้อมูลจาก public.sensor_devices</p>
            </div>
            <button
              className="rounded-[8px] bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-200"
              onClick={() => {
                setLoading(true);
                void loadDevices();
              }}
            >
              รีเฟรช
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Device</th>
                  <th className="px-5 py-3">สถานี</th>
                  <th className="px-5 py-3">ตำแหน่ง</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Seen</th>
                  <th className="px-5 py-3">Readings</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {devices.map((device) => (
                  <tr key={device.device_id} className="hover:bg-blue-50/45">
                    <td className="px-5 py-4">
                      <span className="rounded-[8px] bg-slate-900 px-2.5 py-1 text-xs font-extrabold text-white">{device.device_id}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-extrabold text-slate-800">{device.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{device.location_name ?? "-"}</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                      {device.latitude && device.longitude ? `${Number(device.latitude).toFixed(4)}, ${Number(device.longitude).toFixed(4)}` : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-extrabold",
                          device.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : device.status === "maintenance"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {device.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                      {device.last_seen_at ? sensorAgeLabel(device.last_seen_at) : "ยังไม่ส่งข้อมูล"}
                    </td>
                    <td className="px-5 py-4 font-extrabold text-slate-700">{device.readings_count.toLocaleString("th-TH")}</td>
                    <td className="px-5 py-4">
                      <button
                        className="rounded-[8px] bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-700 hover:bg-blue-100"
                        onClick={() => editDevice(device)}
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
                {devices.length === 0 && !loading && (
                  <tr>
                    <td className="px-5 py-10 text-center text-sm font-semibold text-slate-500" colSpan={7}>
                      ยังไม่มีสถานีเซ็นเซอร์
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
