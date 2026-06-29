import type { LucideIcon } from "lucide-react";
import type { AppUser } from "@/lib/auth";

export type ViewId =
  | "dashboard"
  | "tracking"
  | "forecast"
  | "risk"
  | "evacuation-map"
  | "shelters"
  | "sensor-devices"
  | "users"
  | "sensors"
  | "settings";

export type NavItem = {
  id: ViewId;
  label: string;
  icon: LucideIcon;
};

export type DashboardPermission = AppUser["permissions"][number];

export type SensorReading = {
  id: string;
  device_id: string;
  temperature: string | number;
  humidity: string | number;
  wind_speed: string | number;
  battery: string | number;
  recorded_at: string;
  received_at: string;
};

export type SensorDevice = {
  device_id: string;
  name: string | null;
  location_name: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  status: "active" | "inactive" | "maintenance";
  last_seen_at: string | null;
  last_battery: string | number | null;
  updated_at: string;
  readings_count: number;
};

export type SensorDeviceForm = {
  device_id: string;
  name: string;
  location_name: string;
  latitude: string;
  longitude: string;
  status: "active" | "inactive" | "maintenance";
};
