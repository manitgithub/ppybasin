import type { AppUser } from "@/lib/auth";

export const MAX_REPORT_PHOTOS = 8;
export const MAX_REPORT_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_REPORT_PHOTOS_BYTES = 20 * 1024 * 1024;

export const reportKinds = { flood: "แจ้งน้ำท่วม / สภาพถนน", help: "ขอความช่วยเหลือ", receded: "แจ้งน้ำลด" };
export const waterDepthLabels = { unknown: "ยังไม่ทราบ", dry: "ไม่มีน้ำ", ankle: "ตาตุ่ม", knee: "เข่า", waist: "เอว", neck: "คอ", overhead: "มิดหัว" };
export const reportStatuses = { pending: "รอตรวจสอบ", verified: "ยืนยันเหตุแล้ว", in_progress: "กำลังประสานช่วยเหลือ", resolved: "ปิดเหตุแล้ว", rejected: "ไม่รับรายงาน" };
export const passabilityLabels = { unknown: "ยังไม่ทราบ", passable: "มีรายงานว่าผ่านได้", small_blocked: "รถเล็กผ่านไม่ได้", blocked: "ผ่านไม่ได้ทุกประเภท", dry: "น้ำลด / ไม่พบน้ำ" };
export const assistanceNeeds = ["อพยพ", "อาหารและน้ำดื่ม", "ยารักษาโรค", "ผู้สูงอายุ / ผู้ป่วย", "อื่น ๆ"];
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const canManageReports = (user: AppUser) => user.role === "admin" || user.permissions.includes("reports:manage");
export const canCreateReports = (user: AppUser) => user.role === "admin" || user.role === "viewer" || user.permissions.includes("reports:create");

export type CitizenReport = {
  id: string;
  kind: keyof typeof reportKinds;
  place: string;
  latitude: number | null;
  longitude: number | null;
  observedAt: string;
  passability: keyof typeof passabilityLabels;
  waterDepth: keyof typeof waterDepthLabels;
  description: string;
  contactName: string;
  contactPhone: string;
  peopleCount: number | null;
  needs: string[];
  status: keyof typeof reportStatuses;
  createdAt: string;
  hasPhoto: boolean;
  photos: { id: string; filename: string }[];
  events: { status: keyof typeof reportStatuses; note: string; createdAt: string }[];
};

export const reportSelect = `select r.id, r.kind, r.place, r.latitude, r.longitude,
  r.observed_at as "observedAt", r.passability, r.water_depth as "waterDepth", r.description,
  r.contact_name as "contactName", r.contact_phone as "contactPhone",
  r.people_count as "peopleCount", r.needs, r.status, r.created_at as "createdAt",
  exists(select 1 from public.citizen_report_photos p where p.report_id = r.id) as "hasPhoto",
  coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'filename', p.filename) order by p.sort_order)
    from public.citizen_report_photos p where p.report_id = r.id), '[]'::jsonb) as photos,
  coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'createdAt', e.created_at) order by e.created_at, e.id)
    from public.citizen_report_events e where e.report_id = r.id), '[]'::jsonb) as events
  from public.citizen_reports r`;

export function validateReport(form: FormData) {
  const str = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const kind = str("kind"), place = str("place"), description = str("description"), contactName = str("contactName");
  const contactPhone = str("contactPhone").replace(/[\s-]/g, "");
  const submissionKey = str("submissionKey"), passability = str("passability");
  const observedAt = str("observedAt");
  const waterDepth = str("waterDepth") || "unknown";
  if (!Object.hasOwn(waterDepthLabels, waterDepth)) return { error: "เลือกระดับน้ำจากตัวเลือกที่กำหนด" };
  const latitude = str("latitude") ? Number(str("latitude")) : null;
  const longitude = str("longitude") ? Number(str("longitude")) : null;
  const peopleCount = str("peopleCount") ? Number(str("peopleCount")) : null;
  const needs = form.getAll("needs").map(String);
  if (!Object.hasOwn(reportKinds, kind) || !Object.hasOwn(passabilityLabels, passability) || !isUuid(submissionKey)) return { error: "ประเภทรายงานไม่ถูกต้อง กรุณาลองใหม่" };
  if (place.length < 3 || place.length > 150 || description.length < 5 || description.length > 2000) return { error: "ระบุสถานที่อย่างน้อย 3 ตัวอักษร และรายละเอียดอย่างน้อย 5 ตัวอักษร" };
  if (!contactName || contactName.length > 100 || !/^0\d{8,9}$/.test(contactPhone)) return { error: "กรุณาระบุชื่อและเบอร์โทรศัพท์ไทย 9–10 หลัก" };
  if (!Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt) > Date.now() + 60_000) return { error: "เวลาที่พบเหตุต้องไม่อยู่ในอนาคต" };
  if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return { error: "พิกัดไม่ถูกต้อง กรุณาเลือกตำแหน่งอีกครั้ง" };
  if (kind === "help" && (peopleCount === null || !Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 10000 || !needs.length)) return { error: "ระบุจำนวนผู้ต้องการความช่วยเหลือและสิ่งที่ต้องการ" };
  if (needs.some((need) => !assistanceNeeds.includes(need))) return { error: "รายการความช่วยเหลือไม่ถูกต้อง" };
  return { value: { kind, place, description, contactName, contactPhone, submissionKey, passability, waterDepth, observedAt, latitude, longitude, peopleCount: kind === "help" ? peopleCount : null, needs: kind === "help" ? [...new Set(needs)] : [] } };
}
