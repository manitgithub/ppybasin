import type { AppUser } from "@/lib/auth";
import type { ViewId } from "@/components/dashboard/types";

const viewPermissions: Record<ViewId, string[]> = {
  dashboard: ["dashboard:view"],
  tracking: ["dashboard:view"],
  forecast: ["alerts:manage"],
  risk: ["dashboard:view"],
  "evacuation-map": ["dashboard:view"],
  shelters: ["dashboard:view"],
  "sensor-devices": ["sensors:manage"],
  users: ["users:manage"],
  sensors: ["dashboard:view"],
  settings: ["users:manage"],
};

export function canAccessView(user: AppUser, view: ViewId) {
  if (user.role === "admin") return true;

  const required = viewPermissions[view];
  return required.length === 0 || required.some((permission) => user.permissions.includes(permission));
}

export function firstAllowedView(user: AppUser, views: ViewId[]) {
  return views.find((view) => canAccessView(user, view)) ?? "dashboard";
}
