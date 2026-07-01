"use client";

import dynamic from "next/dynamic";
import { CalendarDays, FileText, Home, Hospital, MapPin, Pencil, Plus, RadioTower, Save, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { DashboardPayload } from "@/lib/dashboard-data";
import type { ShelterForm, ShelterRecord, ShelterStatus, ViewId, Village, VillageForm, VillageRiskStatus } from "@/components/dashboard/types";
import { formatDate } from "@/components/dashboard/utils";

type CategoryViewId = Extract<ViewId, "village-basics" | "shelter-data" | "announcements">;

const ShelterLocationPicker = dynamic(() => import("@/components/dashboard/ShelterLocationPicker"), {
  ssr: false,
  loading: () => <div className="grid h-[330px] place-items-center rounded-[8px] border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">กำลังโหลดแผนที่...</div>,
});

const emptyVillageForm: VillageForm = {
  code: "",
  name: "",
  tambon: "",
  households: "",
  population: "",
  risk_status: "normal",
  primary_shelter: "",
};

const emptyShelterForm: ShelterForm = {
  code: "",
  name: "",
  capacity: "",
  status: "open",
  lat: "",
  lng: "",
};

const riskLabels: Record<VillageRiskStatus, string> = {
  normal: "ปกติ",
  watch: "เฝ้าระวัง",
  high: "เสี่ยงสูง",
};

const shelterStatusLabels: Record<ShelterStatus, string> = {
  open: "เปิดใช้งาน",
  full: "เต็ม",
  closed: "ปิด",
};

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
  "shelter-data": {
    icon: Hospital,
    eyebrow: "SHELTER MASTER DATA",
    title: "ข้อมูลศูนย์อพยพ",
    detail: "รายการศูนย์อพยพจากฐานข้อมูล พร้อมสถานะเปิดใช้งาน พิกัด และจำนวนคนที่รองรับได้",
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
  const [villages, setVillages] = useState<Village[]>([]);
  const [form, setForm] = useState<VillageForm>(emptyVillageForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVillages = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/villages", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "โหลดข้อมูลหมู่บ้านไม่สำเร็จ");
      }

      setVillages(payload.villages ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลหมู่บ้านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadVillages(), 0);

    return () => window.clearTimeout(timer);
  }, [loadVillages]);

  const households = villages.reduce((sum, row) => sum + row.households, 0);
  const population = villages.reduce((sum, row) => sum + row.population, 0);

  const updateForm = (field: keyof VillageForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyVillageForm);
  };

  const editVillage = (village: Village) => {
    setForm({
      id: village.id,
      code: village.code ?? "",
      name: village.name,
      tambon: village.tambon,
      households: String(village.households),
      population: String(village.population),
      risk_status: village.risk_status,
      primary_shelter: village.primary_shelter ?? "",
    });
  };

  const saveVillage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/villages", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          code: form.code,
          name: form.name,
          tambon: form.tambon,
          households: form.households,
          population: form.population,
          risk_status: form.risk_status,
          primary_shelter: form.primary_shelter,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.details?.join(", ") ?? payload.error ?? "บันทึกข้อมูลหมู่บ้านไม่สำเร็จ");
      }

      setMessage(form.id ? "แก้ไขข้อมูลหมู่บ้านแล้ว" : "เพิ่มข้อมูลหมู่บ้านแล้ว");
      resetForm();
      await loadVillages();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกข้อมูลหมู่บ้านไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const deleteVillage = async (village: Village) => {
    const confirmed = window.confirm(`ลบข้อมูล ${village.name} ใช่ไหม`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(village.id);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/villages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: village.id }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "ลบข้อมูลหมู่บ้านไม่สำเร็จ");
      }

      setMessage(`ลบข้อมูล ${village.name} แล้ว`);
      if (form.id === village.id) {
        resetForm();
      }
      await loadVillages();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ลบข้อมูลหมู่บ้านไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="หมู่บ้านในคลัง" value={`${villages.length.toLocaleString("th-TH")} หมู่บ้าน`} icon={Home} />
        <StatCard label="ครัวเรือนรวม" value={households.toLocaleString("th-TH")} icon={Users} />
        <StatCard label="สถานีอ้างอิง" value={`${data.summary.stationsOnline.toLocaleString("th-TH")} สถานี`} icon={RadioTower} />
      </div>

      <form className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm" onSubmit={saveVillage}>
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">{form.id ? "แก้ไขหมู่บ้าน" : "เพิ่มหมู่บ้าน"}</h3>
            <p className="text-xs font-medium text-slate-500">กรอกข้อมูลหลักที่ใช้กับคลังข้อมูลและแผนปฏิบัติการภาคสนาม</p>
          </div>
          <div className="flex gap-2">
            {form.id && (
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
                onClick={resetForm}
              >
                <X size={15} />
                ยกเลิกแก้ไข
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#216ed7] px-4 text-xs font-extrabold text-white shadow-sm hover:bg-[#185bb4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.id ? <Save size={15} /> : <Plus size={15} />}
              {saving ? "กำลังบันทึก" : form.id ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
            </button>
          </div>
        </div>

        {(message || error) && (
          <div
            className={[
              "mb-4 rounded-[8px] px-4 py-3 text-sm font-bold",
              error ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            {error ?? message}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-slate-500">รหัสหมู่บ้าน</span>
            <input
              className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              placeholder="PPY-VIL-001"
              value={form.code}
              onChange={(event) => updateForm("code", event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-slate-500">ชื่อหมู่บ้าน</span>
            <input
              required
              className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              placeholder="บ้าน..."
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-slate-500">ตำบล</span>
            <input
              required
              className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              placeholder="ตำบล..."
              value={form.tambon}
              onChange={(event) => updateForm("tambon", event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-slate-500">ระดับความเสี่ยง</span>
            <select
              className="h-10 w-full rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              value={form.risk_status}
              onChange={(event) => updateForm("risk_status", event.target.value as VillageRiskStatus)}
            >
              <option value="normal">ปกติ</option>
              <option value="watch">เฝ้าระวัง</option>
              <option value="high">เสี่ยงสูง</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-slate-500">ครัวเรือน</span>
            <input
              required
              min={0}
              type="number"
              className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              value={form.households}
              onChange={(event) => updateForm("households", event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold text-slate-500">ประชากร</span>
            <input
              required
              min={0}
              type="number"
              className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              value={form.population}
              onChange={(event) => updateForm("population", event.target.value)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-extrabold text-slate-500">ศูนย์พักพิงหลัก</span>
            <input
              className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              placeholder="ศูนย์พักพิง..."
              value={form.primary_shelter}
              onChange={(event) => updateForm("primary_shelter", event.target.value)}
            />
          </label>
        </div>
      </form>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-extrabold text-slate-800">ทะเบียนหมู่บ้าน</h3>
          <p className="text-xs font-medium text-slate-500">ข้อมูลจาก public.villages สามารถเพิ่ม แก้ไข และลบได้จากหน้านี้</p>
        </div>
        {loading ? (
          <div className="grid min-h-40 place-items-center text-sm font-bold text-slate-500">กำลังโหลดข้อมูลหมู่บ้าน...</div>
        ) : villages.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-center">
            <div>
              <Home className="mx-auto mb-3 size-10 text-blue-600" />
              <p className="text-sm font-extrabold text-slate-800">ยังไม่มีข้อมูลหมู่บ้าน</p>
              <p className="text-xs font-semibold text-slate-500">เพิ่มรายการแรกจากฟอร์มด้านบน</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
              <tr>
                <th className="px-5 py-3">รหัส</th>
                <th className="px-5 py-3">หมู่บ้าน</th>
                <th className="px-5 py-3">ตำบล</th>
                <th className="px-5 py-3">ครัวเรือน</th>
                <th className="px-5 py-3">ประชากร</th>
                <th className="px-5 py-3">ระดับความเสี่ยง</th>
                <th className="px-5 py-3">ศูนย์พักพิงหลัก</th>
                <th className="px-5 py-3">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {villages.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/45">
                  <td className="px-5 py-4 text-xs font-extrabold text-slate-500">{row.code ?? "-"}</td>
                  <td className="px-5 py-4 font-extrabold text-slate-800">{row.name}</td>
                  <td className="px-5 py-4 font-bold text-slate-600">{row.tambon}</td>
                  <td className="px-5 py-4 font-bold text-slate-700">{row.households.toLocaleString("th-TH")}</td>
                  <td className="px-5 py-4 font-bold text-slate-700">{row.population.toLocaleString("th-TH")}</td>
                  <td className="px-5 py-4">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-extrabold",
                        row.risk_status === "high"
                          ? "bg-red-100 text-red-700"
                          : row.risk_status === "watch"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700",
                      ].join(" ")}
                    >
                      {riskLabels[row.risk_status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{row.primary_shelter ?? "-"}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        className="grid size-9 place-items-center rounded-[8px] border border-slate-200 text-slate-600 hover:bg-slate-50"
                        title="แก้ไข"
                        type="button"
                        onClick={() => editVillage(row)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="grid size-9 place-items-center rounded-[8px] border border-red-100 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deletingId === row.id}
                        title="ลบ"
                        type="button"
                        onClick={() => void deleteVillage(row)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
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

function ShelterData({ data }: { data: DashboardPayload }) {
  const [shelters, setShelters] = useState<ShelterRecord[]>(() =>
    data.shelters.map((shelter) => ({
      id: shelter.id,
      code: null,
      name: shelter.name,
      capacity: shelter.capacity,
      status: ["open", "full", "closed"].includes(shelter.status) ? (shelter.status as ShelterStatus) : "closed",
      lat: shelter.lat,
      lng: shelter.lng,
      updated_at: shelter.updatedAt ?? new Date().toISOString(),
    })),
  );
  const [form, setForm] = useState<ShelterForm>(emptyShelterForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadShelters = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/shelters", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "โหลดข้อมูลศูนย์อพยพไม่สำเร็จ");
      }

      setShelters(payload.shelters ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลศูนย์อพยพไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadShelters(), 0);

    return () => window.clearTimeout(timer);
  }, [loadShelters]);

  const openShelters = shelters.filter((shelter) => shelter.status === "open").length;
  const totalCapacity = shelters.reduce((sum, shelter) => sum + shelter.capacity, 0);

  const updateForm = (field: keyof ShelterForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updatePosition = (position: { lat: number; lng: number }) => {
    setForm((current) => ({
      ...current,
      lat: position.lat.toFixed(6),
      lng: position.lng.toFixed(6),
    }));
  };

  const resetForm = () => {
    setForm(emptyShelterForm);
  };

  const editShelter = (shelter: ShelterRecord) => {
    setForm({
      id: shelter.id,
      code: shelter.code ?? "",
      name: shelter.name,
      capacity: String(shelter.capacity),
      status: shelter.status,
      lat: String(shelter.lat),
      lng: String(shelter.lng),
    });
  };

  const saveShelter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/shelters", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          code: form.code,
          name: form.name,
          capacity: form.capacity,
          status: form.status,
          lat: form.lat,
          lng: form.lng,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.details?.join(", ") ?? payload.error ?? "บันทึกข้อมูลศูนย์อพยพไม่สำเร็จ");
      }

      setMessage(form.id ? "แก้ไขข้อมูลศูนย์อพยพแล้ว" : "เพิ่มข้อมูลศูนย์อพยพแล้ว");
      resetForm();
      await loadShelters();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกข้อมูลศูนย์อพยพไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const deleteShelter = async (shelter: ShelterRecord) => {
    const confirmed = window.confirm(`ลบข้อมูล ${shelter.name} ใช่ไหม`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(shelter.id);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/shelters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shelter.id }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "ลบข้อมูลศูนย์อพยพไม่สำเร็จ");
      }

      setMessage(`ลบข้อมูล ${shelter.name} แล้ว`);
      if (form.id === shelter.id) {
        resetForm();
      }
      await loadShelters();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ลบข้อมูลศูนย์อพยพไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="ศูนย์ในฐานข้อมูล" value={`${shelters.length.toLocaleString("th-TH")} แห่ง`} icon={Hospital} />
        <StatCard label="เปิดใช้งาน" value={`${openShelters.toLocaleString("th-TH")} แห่ง`} icon={MapPin} />
        <StatCard label="รองรับรวม" value={`${totalCapacity.toLocaleString("th-TH")} คน`} icon={Users} />
      </div>

      <form className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm" onSubmit={saveShelter}>
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-blue-50 text-[#216ed7]">
              <Hospital size={20} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">{form.id ? "แก้ไขศูนย์อพยพ" : "เพิ่มศูนย์อพยพ"}</h3>
              <p className="mt-1 max-w-2xl text-xs font-semibold text-slate-500">
                จัดเก็บข้อมูลศูนย์ จำนวนรองรับ สถานะ และตำแหน่งจริงสำหรับใช้ประสานงานภาคสนาม
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.id && (
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
                onClick={resetForm}
              >
                <X size={15} />
                ยกเลิกแก้ไข
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#216ed7] px-4 text-xs font-extrabold text-white shadow-sm hover:bg-[#185bb4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.id ? <Save size={15} /> : <Plus size={15} />}
              {saving ? "กำลังบันทึก" : form.id ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
            </button>
          </div>
        </div>

        {(message || error) && (
          <div
            className={[
              "mx-5 mt-5 rounded-[8px] px-4 py-3 text-sm font-bold",
              error ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            {error ?? message}
          </div>
        )}

        <div className="grid gap-0 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,1.08fr)]">
          <div className="space-y-5 px-5 py-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-normal text-[#2c72d9]">Shelter Profile</p>
              <h4 className="mt-1 text-sm font-extrabold text-slate-800">รายละเอียดศูนย์</h4>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-extrabold text-slate-500">รหัสศูนย์</span>
                <input
                  className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                  placeholder="PPY-SH-001"
                  value={form.code}
                  onChange={(event) => updateForm("code", event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-extrabold text-slate-500">จำนวนรองรับ</span>
                <input
                  required
                  min={0}
                  type="number"
                  className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                  value={form.capacity}
                  onChange={(event) => updateForm("capacity", event.target.value)}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-extrabold text-slate-500">ชื่อศูนย์อพยพ</span>
                <input
                  required
                  className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                  placeholder="ศูนย์..."
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                />
              </label>
            </div>

            <div>
              <span className="mb-2 block text-xs font-extrabold text-slate-500">สถานะศูนย์</span>
              <div className="grid grid-cols-3 gap-2 rounded-[8px] border border-slate-200 bg-slate-50 p-1">
                {(Object.keys(shelterStatusLabels) as ShelterStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={[
                      "h-10 rounded-[7px] text-xs font-extrabold transition",
                      form.status === status
                        ? status === "open"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : status === "full"
                            ? "bg-red-600 text-white shadow-sm"
                            : "bg-slate-700 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-800",
                    ].join(" ")}
                    onClick={() => updateForm("status", status)}
                  >
                    {shelterStatusLabels[status]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-extrabold text-slate-500">ค่าพิกัด</span>
                <span className="text-[11px] font-bold text-slate-400">ปรับได้จากช่องกรอกหรือหมุดบนแผนที่</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-extrabold text-slate-500">ละติจูด</span>
                  <input
                    required
                    type="number"
                    step="0.000001"
                    className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                    placeholder="7.789900"
                    value={form.lat}
                    onChange={(event) => updateForm("lat", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-extrabold text-slate-500">ลองจิจูด</span>
                  <input
                    required
                    type="number"
                    step="0.000001"
                    className="h-10 w-full rounded-[8px] border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                    placeholder="100.206500"
                    value={form.lng}
                    onChange={(event) => updateForm("lng", event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 p-5 xl:border-l xl:border-t-0">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-normal text-[#2c72d9]">Map Pin</p>
                <h4 className="mt-1 text-sm font-extrabold text-slate-800">ตำแหน่งศูนย์อพยพ</h4>
              </div>
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700">
                <MapPin size={14} className="text-[#216ed7]" />
                {form.lat || "7.789200"}, {form.lng || "100.203500"}
              </div>
            </div>
            <ShelterLocationPicker
              lat={form.lat}
              lng={form.lng}
              onChange={updatePosition}
              helperText="คลิกบนแผนที่หรือเลื่อนหมุดเพื่อกำหนดพิกัดศูนย์อพยพ"
            />
          </div>
        </div>
      </form>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-extrabold text-slate-800">ทะเบียนศูนย์อพยพ</h3>
          <p className="text-xs font-medium text-slate-500">ข้อมูลจาก public.shelters สามารถเพิ่ม แก้ไข และลบได้จากหน้านี้</p>
        </div>
        {loading ? (
          <div className="grid min-h-40 place-items-center text-sm font-bold text-slate-500">กำลังโหลดข้อมูลศูนย์อพยพ...</div>
        ) : shelters.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-center">
            <div>
              <Hospital className="mx-auto mb-3 size-10 text-blue-600" />
              <p className="text-sm font-extrabold text-slate-800">ยังไม่มีข้อมูลศูนย์อพยพ</p>
              <p className="text-xs font-semibold text-slate-500">เพิ่มรายการแรกจากฟอร์มด้านบน</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
                <tr>
                  <th className="px-5 py-3">รหัส</th>
                  <th className="px-5 py-3">ศูนย์อพยพ</th>
                  <th className="px-5 py-3">จำนวนรองรับ</th>
                  <th className="px-5 py-3">สถานะ</th>
                  <th className="px-5 py-3">ละติจูด</th>
                  <th className="px-5 py-3">ลองจิจูด</th>
                  <th className="px-5 py-3">อัปเดตล่าสุด</th>
                  <th className="px-5 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shelters.map((shelter) => (
                  <tr key={shelter.id} className="hover:bg-blue-50/45">
                    <td className="px-5 py-4 text-xs font-extrabold text-slate-500">{shelter.code ?? "-"}</td>
                    <td className="px-5 py-4 font-extrabold text-slate-800">{shelter.name}</td>
                    <td className="px-5 py-4 font-bold text-slate-700">{shelter.capacity.toLocaleString("th-TH")} คน</td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-extrabold",
                          shelter.status === "open"
                            ? "bg-emerald-100 text-emerald-700"
                            : shelter.status === "full"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {shelterStatusLabels[shelter.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{shelter.lat.toFixed(5)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{shelter.lng.toFixed(5)}</td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-500">{formatDate(shelter.updated_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          className="grid size-9 place-items-center rounded-[8px] border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="แก้ไข"
                          type="button"
                          onClick={() => editShelter(shelter)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="grid size-9 place-items-center rounded-[8px] border border-red-100 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingId === shelter.id}
                          title="ลบ"
                          type="button"
                          onClick={() => void deleteShelter(shelter)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {viewId === "village-basics" && <VillageBasics data={data} />}
      {viewId === "shelter-data" && <ShelterData data={data} />}
      {viewId === "announcements" && <Announcements />}
    </section>
  );
}
