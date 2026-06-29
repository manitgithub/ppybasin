import { listUsers, requireAdmin, updateUserAccess, type UserRole, type UserStatus } from "@/lib/auth";

export const dynamic = "force-dynamic";

const allowedPermissions = new Set(["dashboard:view", "alerts:manage", "sensors:manage", "users:manage"]);
const allowedRoles = new Set<UserRole>(["admin", "operator", "viewer"]);
const allowedStatuses = new Set<UserStatus>(["active", "disabled"]);

type UpdateUserBody = {
  id?: unknown;
  role?: unknown;
  status?: unknown;
  permissions?: unknown;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    return Response.json({ ok: true, users: await listUsers() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to list users", error);
    return Response.json({ ok: false, error: "Unable to list users" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: UpdateUserBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const role = typeof body.role === "string" ? body.role : "";
  const status = typeof body.status === "string" ? body.status : "";
  const permissions = Array.isArray(body.permissions)
    ? body.permissions.filter((permission): permission is string => typeof permission === "string" && allowedPermissions.has(permission))
    : [];

  if (!id || !allowedRoles.has(role as UserRole) || !allowedStatuses.has(status as UserStatus)) {
    return Response.json({ ok: false, error: "Validation failed" }, { status: 422 });
  }

  try {
    const user = await updateUserAccess({
      id,
      role: role as UserRole,
      status: status as UserStatus,
      permissions,
    });

    if (!user) {
      return Response.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return Response.json({ ok: true, user });
  } catch (error) {
    console.error("Unable to update user access", error);
    return Response.json({ ok: false, error: "Unable to update user access" }, { status: 500 });
  }
}
