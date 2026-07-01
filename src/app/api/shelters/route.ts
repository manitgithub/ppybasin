import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type ShelterBody = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  capacity?: unknown;
  status?: unknown;
  lat?: unknown;
  lng?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalTextValue(value: unknown) {
  const text = textValue(value);
  return text || null;
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function integerValue(value: unknown) {
  const numeric = optionalNumber(value);
  return typeof numeric === "number" && Number.isInteger(numeric) ? numeric : undefined;
}

async function canManageShelters() {
  const user = await getCurrentUser();
  return Boolean(user && (user.role === "admin" || user.permissions.includes("sensors:manage")));
}

function validateShelterPayload(body: ShelterBody) {
  const errors: string[] = [];
  const id = textValue(body.id);
  const code = optionalTextValue(body.code);
  const name = textValue(body.name);
  const capacity = integerValue(body.capacity);
  const status = textValue(body.status) || "open";
  const lat = optionalNumber(body.lat);
  const lng = optionalNumber(body.lng);

  if (!name) {
    errors.push("name is required");
  }

  if (capacity === undefined || capacity < 0) {
    errors.push("capacity must be a positive integer");
  }

  if (!["open", "full", "closed"].includes(status)) {
    errors.push("status must be open, full, or closed");
  }

  if (lat === undefined || lat < -90 || lat > 90) {
    errors.push("lat must be a number between -90 and 90");
  }

  if (lng === undefined || lng < -180 || lng > 180) {
    errors.push("lng must be a number between -180 and 180");
  }

  if (code && code.length > 64) {
    errors.push("code must be 64 characters or less");
  }

  if (errors.length) {
    return { errors };
  }

  return {
    payload: {
      id,
      code,
      name,
      capacity,
      status,
      lat,
      lng,
    },
  };
}

export async function GET() {
  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query(`
      select
        id::text,
        code,
        name,
        capacity,
        status,
        ST_Y(geom::geometry) as lat,
        ST_X(geom::geometry) as lng,
        updated_at
      from public.shelters
      order by
        case status when 'open' then 1 when 'full' then 2 else 3 end,
        name
    `);

    return Response.json({ ok: true, shelters: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load shelters", error);
    return Response.json({ ok: false, error: "Unable to load shelters" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await canManageShelters())) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: ShelterBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, errors } = validateShelterPayload(body);

  if (!payload) {
    return Response.json({ ok: false, error: "Validation failed", details: errors }, { status: 422 });
  }

  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query(
      `
        insert into public.shelters (code, name, capacity, status, geom, updated_at)
        values ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), now())
        on conflict (code) do update set
          name = excluded.name,
          capacity = excluded.capacity,
          status = excluded.status,
          geom = excluded.geom,
          updated_at = now()
        returning id::text
      `,
      [payload.code, payload.name, payload.capacity, payload.status, payload.lng, payload.lat],
    );

    return Response.json({ ok: true, id: result.rows[0]?.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save shelter", error);
    return Response.json({ ok: false, error: "Unable to save shelter" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await canManageShelters())) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: ShelterBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, errors } = validateShelterPayload(body);

  if (!payload || !payload.id) {
    return Response.json({ ok: false, error: "Validation failed", details: errors ?? ["id is required"] }, { status: 422 });
  }

  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query(
      `
        update public.shelters
        set
          code = $2,
          name = $3,
          capacity = $4,
          status = $5,
          geom = ST_SetSRID(ST_MakePoint($6, $7), 4326),
          updated_at = now()
        where id = $1::bigint
        returning id::text
      `,
      [payload.id, payload.code, payload.name, payload.capacity, payload.status, payload.lng, payload.lat],
    );

    if (!result.rows[0]) {
      return Response.json({ ok: false, error: "Shelter not found" }, { status: 404 });
    }

    return Response.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Unable to update shelter", error);
    return Response.json({ ok: false, error: "Unable to update shelter" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await canManageShelters())) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: ShelterBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = textValue(body.id);

  if (!id) {
    return Response.json({ ok: false, error: "id is required" }, { status: 422 });
  }

  const db = getPool();

  if (!db) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  try {
    const result = await db.query("delete from public.shelters where id = $1::bigint returning id::text", [id]);

    if (!result.rows[0]) {
      return Response.json({ ok: false, error: "Shelter not found" }, { status: 404 });
    }

    return Response.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error("Unable to delete shelter", error);
    return Response.json({ ok: false, error: "Unable to delete shelter" }, { status: 500 });
  }
}
