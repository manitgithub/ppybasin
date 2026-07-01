import crypto from "crypto";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";

export const SESSION_COOKIE = "ppybasin_session";
const bypassPermissions = ["dashboard:view", "users:manage", "sensors:manage", "alerts:manage"];

export type UserRole = "admin" | "operator" | "viewer";
export type UserStatus = "active" | "disabled";

export type AppUser = {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserRow = {
  id: string;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  permissions: string[] | string;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    email: row.email,
    role: row.role,
    status: row.status,
    permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions || "[]"),
    lastLoginAt: toIso(row.last_login_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function sessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function sessionMaxAgeSeconds() {
  return 60 * 60 * 24 * 7;
}

function isConfiguredAdmin(lineUserId: string) {
  return (process.env.LINE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(lineUserId);
}

function isAuthBypassEnabled() {
  return ["1", "true", "yes", "on"].includes((process.env.AUTH_BYPASS ?? "").trim().toLowerCase());
}

function bypassUser(): AppUser {
  const now = new Date().toISOString();

  return {
    id: "auth-bypass-user",
    lineUserId: "auth-bypass",
    displayName: process.env.AUTH_BYPASS_DISPLAY_NAME || "Dev Admin",
    pictureUrl: null,
    email: null,
    role: "admin",
    status: "active",
    permissions: bypassPermissions,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function authConfigError() {
  if (isAuthBypassEnabled()) return null;
  if (!process.env.DATABASE_URL) return "DATABASE_URL is not configured";
  if (!process.env.AUTH_SECRET) return "AUTH_SECRET is not configured";
  return null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (isAuthBypassEnabled()) {
    return bypassUser();
  }

  const db = getPool();
  if (!db) return null;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const result = await db.query<UserRow>(
      `
        update public.auth_sessions s
        set last_seen_at = now()
        from public.app_users u
        where s.user_id = u.id
          and s.session_token_hash = $1
          and s.expires_at > now()
          and u.status = 'active'
        returning
          u.id,
          u.line_user_id,
          u.display_name,
          u.picture_url,
          u.email,
          u.role,
          u.status,
          u.permissions,
          u.last_login_at,
          u.created_at,
          u.updated_at
      `,
      [hashToken(token)],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  } catch (error) {
    console.error("Unable to load current user", error);
    return null;
  }
}

export async function createSession(userId: string) {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL is not configured");

  const token = sessionToken();
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds() * 1000);

  await db.query(
    `
      insert into public.auth_sessions (user_id, session_token_hash, expires_at)
      values ($1, $2, $3)
    `,
    [userId, hashToken(token), expiresAt],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds(),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const db = getPool();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (db && token) {
    await db.query("delete from public.auth_sessions where session_token_hash = $1", [hashToken(token)]);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function upsertLineUser(profile: {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
  email?: string | null;
}) {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL is not configured");

  const countResult = await db.query<{ count: string }>("select count(*)::text as count from public.app_users");
  const isFirstUser = Number(countResult.rows[0]?.count ?? 0) === 0;
  const isAdmin = isFirstUser || isConfiguredAdmin(profile.lineUserId);
  const adminPermissions = ["dashboard:view", "users:manage", "sensors:manage", "alerts:manage"];
  const viewerPermissions = ["dashboard:view"];

  const result = await db.query<UserRow>(
    `
      insert into public.app_users (
        line_user_id,
        display_name,
        picture_url,
        email,
        role,
        permissions,
        last_login_at
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, now())
      on conflict (line_user_id) do update set
        display_name = excluded.display_name,
        picture_url = excluded.picture_url,
        email = coalesce(excluded.email, public.app_users.email),
        role = case when $7 then 'admin' else public.app_users.role end,
        status = case when $7 then 'active' else public.app_users.status end,
        permissions = case when $7 then $6::jsonb else public.app_users.permissions end,
        last_login_at = now(),
        updated_at = now()
      returning
        id,
        line_user_id,
        display_name,
        picture_url,
        email,
        role,
        status,
        permissions,
        last_login_at,
        created_at,
        updated_at
    `,
    [
      profile.lineUserId,
      profile.displayName,
      profile.pictureUrl ?? null,
      profile.email ?? null,
      isAdmin ? "admin" : "viewer",
      JSON.stringify(isAdmin ? adminPermissions : viewerPermissions),
      isAdmin,
    ],
  );

  return mapUser(result.rows[0]);
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}

export async function listUsers() {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL is not configured");

  const result = await db.query<UserRow>(`
    select
      id,
      line_user_id,
      display_name,
      picture_url,
      email,
      role,
      status,
      permissions,
      last_login_at,
      created_at,
      updated_at
    from public.app_users
    order by
      case role when 'admin' then 1 when 'operator' then 2 else 3 end,
      display_name
  `);

  return result.rows.map(mapUser);
}

export async function updateUserAccess(input: {
  id: string;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
}) {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL is not configured");

  const result = await db.query<UserRow>(
    `
      update public.app_users
      set
        role = $2,
        status = $3,
        permissions = $4::jsonb,
        updated_at = now()
      where id = $1
      returning
        id,
        line_user_id,
        display_name,
        picture_url,
        email,
        role,
        status,
        permissions,
        last_login_at,
        created_at,
        updated_at
    `,
    [input.id, input.role, input.status, JSON.stringify(input.permissions)],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}
