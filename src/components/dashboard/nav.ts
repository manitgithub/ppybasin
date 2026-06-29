import {
  Activity,
  AlertTriangle,
  ChartNoAxesCombined,
  Database,
  FileChartColumn,
  Home,
  Hospital,
  Map,
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
  { id: "sensor-devices", label: "คลังข้อมูล", icon: Database },
  { id: "users", label: "จัดการสิทธิ์ผู้ใช้", icon: Users },
  { id: "sensors", label: "รายงานสถานการณ์", icon: FileChartColumn },
  { id: "settings", label: "ตั้งค่าระบบ", icon: Settings },
];
