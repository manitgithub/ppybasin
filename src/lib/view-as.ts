import type { AppUser, UserRole } from "@/lib/auth";

// Lets a signed-in user preview the system with a lower role. It can only ever remove access:
// the effective user is computed on the server from the real account on every request.
export const VIEW_AS_COOKIE = "ppybasin_view_as";

const roleViews: Record<UserRole, UserRole[]> = {
  admin: ["admin", "operator", "volunteer", "viewer"],
  // Operators and volunteers hold different permissions, so neither may preview the other.
  operator: ["operator", "viewer"],
  volunteer: ["volunteer", "viewer"],
  viewer: ["viewer"],
};

export const viewRolePermissions: Record<UserRole, string[]> = {
  admin: [],
  operator: ["dashboard:view", "alerts:manage", "sensors:manage", "reports:manage", "reports:create"],
  volunteer: ["dashboard:view", "reports:create", "reports:claim", "roads:manage"],
  viewer: ["dashboard:view", "reports:create"],
};

export function availableViewRoles(role: UserRole) {
  return roleViews[role] ?? [role];
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "operator" || value === "volunteer" || value === "viewer";
}

export function applyViewAs(user: AppUser, requested: string | undefined): AppUser {
  const availableRoles = availableViewRoles(user.role);
  const base = { ...user, actualRole: user.role, availableRoles };
  if (!isUserRole(requested) || requested === user.role || !availableRoles.includes(requested)) return base;
  const preset = viewRolePermissions[requested];
  // Admins may preview any preset; everyone else keeps only what they already had.
  const permissions = user.role === "admin" ? [...preset] : user.permissions.filter((permission) => preset.includes(permission));
  return { ...base, role: requested, permissions };
}
