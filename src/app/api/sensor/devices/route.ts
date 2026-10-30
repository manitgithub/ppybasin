import { getPool } from "@/lib/db";
import type { PoolClient } from "pg";

export const dynamic = "force-dynamic";

type DeviceRequestBody = {
  original_device_id?: unknown;
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
  const deviceId = textValue(body.device_id);
  const originalDeviceId = textValue(body.original_device_id);
  const name = textValue(body.name);
  const locationName = textValue(body.location_name);
  const status = textValue(body.status) || "active";
  const latitude = optionalNumber(body.latitude);
  const longitude = optionalNumber(body.longitude);

  if (!deviceId) {
    errors.push("device_id is required");
  } else if (!/^[A-Za-z0-9_-]{2,64}$/.test(deviceId)) {
    errors.push("device_id must be 2-64 characters and contain only letters, numbers, underscore, or dash");
  }
  if (originalDeviceId && !/^[A-Za-z0-9_-]{2,64}$/.test(originalDeviceId)) errors.push("original_device_id is invalid");

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
      originalDeviceId,
      name,
      locationName: locationName || null,
      latitude,
      longitude,
      status,
    },
  };
}

export async function GET(request: Request) {
  const includeHidden = new URL(request.url).searchParams.get("include_hidden") === "1";
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
        coalesce(d.metadata->>'excluded_from_installation_list', 'false') = 'true' as hidden_from_map,
        count(r.id)::int as readings_count,
        (
          select json_build_object(
            'recorded_at', latest.recorded_at,
            'temperature', latest.temperature,
            'humidity', latest.humidity,
            'wind_speed', latest.wind_speed,
            'direction', latest.direction,
            'rainfall', latest.rainfall,
            'water_level', latest.water_level,
            'batteryVoltage', coalesce(latest.battery_1, latest.battery),
            'switchingVoltage', latest.battery_2
          )
          from public.sensor_readings latest
          where latest.device_id = d.device_id
          order by latest.recorded_at desc, latest.received_at desc, latest.id desc
          limit 1
        ) as latest_reading
      from public.sensor_devices d
      left join public.sensor_readings r on r.device_id = d.device_id
      where ($1::boolean or coalesce(d.metadata->>'excluded_from_installation_list', 'false') <> 'true')
        and coalesce(d.metadata->>'deleted_at', '') = ''
      group by d.device_id
      order by d.device_id
    `, [includeHidden]);

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

  let client: PoolClient | undefined;
  try {
    client = await db.connect();
    await client.query("begin");
    if (payload.originalDeviceId) {
      const existing = await client.query("select device_id, name, metadata from public.sensor_devices where device_id = any($1::text[]) order by device_id for update", [[payload.originalDeviceId, payload.deviceId]]);
      const original = existing.rows.find(row => row.device_id === payload.originalDeviceId);
      const target = existing.rows.find(row => row.device_id === payload.deviceId);
      if (!original) {
        await client.query("rollback");
        return Response.json({ ok: false, error: "ไม่พบสถานีเดิม กรุณารีเฟรชรายการ" }, { status: 404 });
      }
      if (payload.originalDeviceId !== payload.deviceId) {
        if (target) {
          if (target.name && target.metadata?.excluded_from_installation_list !== true) {
            await client.query("rollback");
            return Response.json({ ok: false, error: "รหัสนี้เป็นของสถานีอื่นแล้ว กรุณาเลือกแก้ไขสถานีนั้น" }, { status: 409 });
          }
          const overlap = await client.query(`select 1 from public.sensor_readings a join public.sensor_readings b on a.recorded_at = b.recorded_at where a.device_id = $1 and b.device_id = $2 limit 1`, [payload.originalDeviceId, payload.deviceId]);
          if (overlap.rowCount) {
            await client.query("rollback");
            return Response.json({ ok: false, error: "ทั้งสองรหัสมีข้อมูลเวลาเดียวกัน กรุณาตรวจสอบก่อนรวมสถานี" }, { status: 409 });
          }
          await client.query("update public.sensor_readings set device_id = $2 where device_id = $1", [payload.originalDeviceId, payload.deviceId]);
          await client.query(`update public.sensor_devices target set metadata = source.metadata || target.metadata,
            last_seen_at = greatest(source.last_seen_at, target.last_seen_at),
            last_battery = case when source.last_seen_at > target.last_seen_at or target.last_seen_at is null then source.last_battery else target.last_battery end
            from public.sensor_devices source where source.device_id = $1 and target.device_id = $2`, [payload.originalDeviceId, payload.deviceId]);
          await client.query("delete from public.sensor_devices where device_id = $1", [payload.originalDeviceId]);
        } else {
          // The readings foreign key cascades the ID change, preserving history.
          await client.query("update public.sensor_devices set device_id = $2 where device_id = $1", [payload.originalDeviceId, payload.deviceId]);
        }
      }
    }
    const result = await client.query(
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
        values ($1, $2, $3, $4, $5, $6, '{"source":"dashboard","excluded_from_installation_list":false}'::jsonb)
        on conflict (device_id) do update set
          name = excluded.name,
          location_name = excluded.location_name,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          status = excluded.status,
          metadata = (public.sensor_devices.metadata - 'deleted_at') || excluded.metadata,
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
    await client.query("commit");

    return Response.json({ ok: true, device_id: result.rows[0]?.device_id }, { status: 201 });
  } catch (error) {
    await client?.query("rollback");
    console.error("Unable to save sensor device", error);
    return Response.json({ ok: false, error: "Unable to save sensor device" }, { status: 500 });
  } finally {
    client?.release();
  }
}

export async function DELETE(request: Request) {
  let deviceId = "";
  try {
    const body = await request.json();
    deviceId = textValue(body?.device_id);
  } catch {
    return Response.json({ ok: false, error: "คำขอลบสถานีไม่ถูกต้อง" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(deviceId)) {
    return Response.json({ ok: false, error: "รหัสสถานีไม่ถูกต้อง" }, { status: 400 });
  }
  const db = getPool();
  if (!db) return Response.json({ ok: false, error: "เชื่อมต่อฐานข้อมูลไม่ได้" }, { status: 503 });
  try {
    // Retain the device identity and readings so ingest cannot recreate a
    // deleted station on the map, and historical measurements remain intact.
    const result = await db.query(`
      update public.sensor_devices
      set status = 'inactive',
        metadata = metadata || jsonb_build_object('excluded_from_installation_list', true, 'deleted_at', now()),
        updated_at = now()
      where device_id = $1 and coalesce(metadata->>'deleted_at', '') = ''
      returning device_id
    `, [deviceId]);
    if (!result.rowCount) return Response.json({ ok: false, error: "ไม่พบสถานี หรือสถานีถูกลบแล้ว" }, { status: 404 });
    return Response.json({ ok: true, device_id: deviceId });
  } catch (error) {
    console.error("Unable to delete sensor device", error);
    return Response.json({ ok: false, error: "ลบสถานีไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
