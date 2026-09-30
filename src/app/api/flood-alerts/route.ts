import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type AlertBody = {
  id?: unknown;
  action?: unknown;
  title?: unknown;
  areaName?: unknown;
  message?: unknown;
  severity?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  radiusM?: unknown;
  blockedRoads?: unknown;
};

const alertSelect = `
  select
    id::text,
    title,
    area_name as "areaName",
    message,
    severity,
    status,
    latitude,
    longitude,
    radius_m as "radiusM",
    blocked_roads as "blockedRoads",
    created_by_name as "createdByName",
    approved_by_name as "approvedByName",
    resolved_by_name as "resolvedByName",
    created_at as "createdAt",
    approved_at as "approvedAt",
    resolved_at as "resolvedAt",
    expires_at as "expiresAt"
  from public.flood_alerts
`;

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db = getPool();
  if (!db) {
    return Response.json({ ok: true, alerts: [], databaseConfigured: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const canManage = user.role === "admin" || user.permissions.includes("alerts:manage");
  const result = await db.query(
    `${alertSelect}
     where ${canManage ? "true" : "status = 'approved' and (expires_at is null or expires_at > now())"}
     order by created_at desc
     limit 50`,
  );

  return Response.json({ ok: true, alerts: result.rows, databaseConfigured: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && !user.permissions.includes("alerts:manage"))) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const db = getPool();
  if (!db) return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });

  let body: AlertBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const title = textValue(body.title);
  const areaName = textValue(body.areaName);
  const message = textValue(body.message);
  const severity = textValue(body.severity);
  const latitude = numberValue(body.latitude);
  const longitude = numberValue(body.longitude);
  const radiusM = numberValue(body.radiusM);
  const blockedRoads = Array.isArray(body.blockedRoads)
    ? body.blockedRoads.map(textValue).filter(Boolean).slice(0, 20)
    : [];

  if (
    !title || !areaName || !message || !["watch", "warning", "critical"].includes(severity) ||
    latitude === null || latitude < -90 || latitude > 90 || longitude === null || longitude < -180 || longitude > 180 ||
    radiusM === null || radiusM < 100 || radiusM > 50000
  ) {
    return Response.json({ ok: false, error: "Validation failed" }, { status: 422 });
  }

  const result = await db.query(
    `insert into public.flood_alerts (
       title, area_name, message, severity, status, latitude, longitude, radius_m,
       blocked_roads, created_by, created_by_name
     ) values ($1, $2, $3, $4, 'pending', $5, $6, $7, $8::jsonb, $9, $10)
     returning
       id::text, title, area_name as "areaName", message, severity, status,
       latitude, longitude, radius_m as "radiusM", blocked_roads as "blockedRoads",
       created_by_name as "createdByName", approved_by_name as "approvedByName",
       resolved_by_name as "resolvedByName", created_at as "createdAt",
       approved_at as "approvedAt", resolved_at as "resolvedAt", expires_at as "expiresAt"`,
    [title, areaName, message, severity, latitude, longitude, Math.round(radiusM), JSON.stringify(blockedRoads), user.id, user.displayName],
  );

  return Response.json({ ok: true, alert: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = getPool();
  if (!db) return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });

  let body: AlertBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = textValue(body.id);
  const action = textValue(body.action);
  if (!id || !["approve", "reject", "resolve"].includes(action)) {
    return Response.json({ ok: false, error: "Validation failed" }, { status: 422 });
  }

  const result = action === "resolve"
    ? await db.query(
      `update public.flood_alerts
       set status = 'resolved', resolved_by = $2, resolved_by_name = $3, resolved_at = now()
       where id = $1 and status = 'approved'
       returning
         id::text, title, area_name as "areaName", message, severity, status,
         latitude, longitude, radius_m as "radiusM", blocked_roads as "blockedRoads",
         created_by_name as "createdByName", approved_by_name as "approvedByName",
         resolved_by_name as "resolvedByName", created_at as "createdAt",
         approved_at as "approvedAt", resolved_at as "resolvedAt", expires_at as "expiresAt"`,
      [id, user.id, user.displayName],
    )
    : await db.query(
      `update public.flood_alerts
       set status = $2, approved_by = $3, approved_by_name = $4,
           approved_at = case when $2 = 'approved' then now() else null end
       where id = $1 and status = 'pending'
       returning
         id::text, title, area_name as "areaName", message, severity, status,
         latitude, longitude, radius_m as "radiusM", blocked_roads as "blockedRoads",
         created_by_name as "createdByName", approved_by_name as "approvedByName",
         resolved_by_name as "resolvedByName", created_at as "createdAt",
         approved_at as "approvedAt", resolved_at as "resolvedAt", expires_at as "expiresAt"`,
      [id, action === "approve" ? "approved" : "rejected", user.id, user.displayName],
    );

  if (!result.rows[0]) return Response.json({ ok: false, error: "Alert not found or status has changed" }, { status: 404 });
  return Response.json({ ok: true, alert: result.rows[0] });
}
