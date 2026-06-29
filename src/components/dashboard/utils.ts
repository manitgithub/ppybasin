import type { UserRole } from "@/lib/auth";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

export function sensorAgeLabel(value?: string) {
  if (!value) {
    return "ยังไม่มีข้อมูล";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) return "เมื่อสักครู่";
  if (diffMinutes < 60) return `${diffMinutes.toLocaleString("th-TH")} นาทีที่แล้ว`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours.toLocaleString("th-TH")} ชั่วโมงที่แล้ว`;

  return `${Math.floor(diffHours / 24).toLocaleString("th-TH")} วันที่แล้ว`;
}

export function roleLabel(role: UserRole) {
  if (role === "admin") return "ผู้ดูแลระบบ";
  if (role === "operator") return "เจ้าหน้าที่ปฏิบัติการ";
  return "ผู้ติดตามสถานการณ์";
}
