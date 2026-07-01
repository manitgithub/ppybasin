import {
  Activity,
  AlertTriangle,
  ChartNoAxesCombined,
  Database,
  FileText,
  Home,
  Hospital,
  Map,
  RadioTower,
  Settings,
  Users,
} from "lucide-react";
import type { NavItem } from "@/components/dashboard/types";

export const navItems: NavItem[] = [
  { id: "dashboard", label: "หน้าหลัก", icon: Home },
  { id: "tracking", label: "ติดตามสถานการณ์", icon: Activity },
  { id: "forecast", label: "คาดการณ์และแจ้งเตือน", icon: AlertTriangle },
  { id: "risk", label: "วิเคราะห์ความเสี่ยง", icon: ChartNoAxesCombined },
  { id: "evacuation-map", label: "แผนที่และเส้นทางอพยพ", icon: Map },
  { id: "shelters", label: "ศูนย์อพยพ", icon: Hospital },
  {
    id: "sensor-devices",
    label: "คลังข้อมูล",
    icon: Database,
    children: [
      { id: "sensor-devices", label: "สถานีตรวจวัด", icon: RadioTower },
      { id: "village-basics", label: "ข้อมูลพื้นฐานหมู่บ้าน", icon: Home },
      { id: "shelter-data", label: "ข้อมูลศูนย์อพยพ", icon: Hospital },
      { id: "announcements", label: "ประกาศข่าว", icon: FileText },
    ],
  },
  { id: "users", label: "จัดการสิทธิ์ผู้ใช้", icon: Users },
  { id: "settings", label: "ตั้งค่าระบบ", icon: Settings },
];
