import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type DeviceRequestBody = {
  device_id?: unknown;
  name?: unknown;
  location_name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  status?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function validateDevicePayload(body: DeviceRequestBody) {
  const errors: string[] = [];
  const deviceId = textValue(body.device_id).toUpperCase();
  const name = textValue(body.name);
  const locationName = textValue(body.location_name);
  const status = textValue(body.status) || "active";
  const latitude = optionalNumber(body.latitude);
  const longitude = optionalNumber(body.longitude);

  if (!deviceId) {
    errors.push("device_id is required");
  } else if (!/^[A-Z0-9_-]{2,64}$/.test(deviceId)) {
    errors.push("device_id must be 2-64 characters and contain only letters, numbers, underscore, or dash");
  }

  if (!name) {
    errors.push("name is required");
  }

  if (!["active", "inactive", "maintenance"].includes(status)) {
    errors.push("status must be active, inactive, or maintenance");
  }

  if (latitude === undefined || (latitude !== null && (latitude < -90 || latitude > 90))) {
    errors.push("latitude must be empty or a number between -90 and 90");
  }

  if (longitude === undefined || (longitude !== null && (longitude < -180 || longitude > 180))) {
    errors.push("longitude must be empty or a number between -180 and 180");
  }

  if (errors.length) {
    return { errors };
  }

  return {
    payload: {
      deviceId,
      name,
      locationName: locationName || null,
      latitude,
      longitude,
      status,
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
        d.device_id,
        d.name,
        d.location_name,
        d.latitude,
        d.longitude,
        d.status,
        d.last_seen_at,
        d.last_battery,
        d.updated_at,
        count(r.id)::int as readings_count
      from public.sensor_devices d
      left join public.sensor_readings r on r.device_id = d.device_id
      group by d.device_id
      order by d.device_id
    `);

    return Response.json({ ok: true, devices: result.rows });
  } catch (error) {
    console.error("Unable to load sensor devices", error);
    return Response.json({ ok: false, error: "Unable to load sensor devices" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: DeviceRequestBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { payload, errors } = validateDevicePayload(body);

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
        insert into public.sensor_devices (
          device_id,
          name,
          location_name,
          latitude,
          longitude,
          status,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, '{"source":"dashboard"}'::jsonb)
        on conflict (device_id) do update set
          name = excluded.name,
          location_name = excluded.location_name,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          status = excluded.status,
          metadata = public.sensor_devices.metadata || excluded.metadata,
          updated_at = now()
        returning device_id
      `,
      [
        payload.deviceId,
        payload.name,
        payload.locationName,
        payload.latitude,
        payload.longitude,
        payload.status,
      ],
    );

    return Response.json({ ok: true, device_id: result.rows[0]?.device_id }, { status: 201 });
  } catch (error) {
    console.error("Unable to save sensor device", error);
    return Response.json({ ok: false, error: "Unable to save sensor device" }, { status: 500 });
  }
}
