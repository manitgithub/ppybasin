import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type SensorRequestBody = {
  device_id?: unknown;
  temperature?: unknown;
  humidity?: unknown;
  wind_speed?: unknown;
  battery?: unknown;
  timestamp?: unknown;
};

type ValidSensorPayload = {
  deviceId: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  battery: number;
  recordedAt: Date;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateSensorPayload(body: SensorRequestBody): { payload?: ValidSensorPayload; errors?: string[] } {
  const errors: string[] = [];
  const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
  const timestamp = typeof body.timestamp === "string" ? body.timestamp.trim() : "";
  const recordedAt = timestamp ? new Date(timestamp) : new Date();

  if (!deviceId) {
    errors.push("device_id is required");
  } else if (!/^[A-Za-z0-9_-]{2,64}$/.test(deviceId)) {
    errors.push("device_id must be 2-64 characters and contain only letters, numbers, underscore, or dash");
  }

  if (!isFiniteNumber(body.temperature) || body.temperature < -50 || body.temperature > 100) {
    errors.push("temperature must be a number between -50 and 100");
  }

  if (!isFiniteNumber(body.humidity) || body.humidity < 0 || body.humidity > 100) {
    errors.push("humidity must be a number between 0 and 100");
  }

  if (!isFiniteNumber(body.wind_speed) || body.wind_speed < 0 || body.wind_speed > 150) {
    errors.push("wind_speed must be a number between 0 and 150");
  }

  if (!isFiniteNumber(body.battery) || body.battery < 0 || body.battery > 30) {
    errors.push("battery must be a number between 0 and 30");
  }

  if (timestamp && Number.isNaN(recordedAt.getTime())) {
    errors.push("timestamp must be a valid ISO 8601 datetime");
  }

  if (errors.length) {
    return { errors };
  }

  return {
    payload: {
      deviceId,
      temperature: body.temperature as number,
      humidity: body.humidity as number,
      windSpeed: body.wind_speed as number,
      battery: body.battery as number,
      recordedAt,
    },
  };
}

export async function POST(request: Request) {
  let body: SensorRequestBody;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { payload, errors } = validateSensorPayload(body);

  if (!payload) {
    return Response.json(
      { ok: false, error: "Validation failed", details: errors },
      { status: 422 },
    );
  }

  const db = getPool();

  if (!db) {
    return Response.json(
      { ok: false, error: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }

  try {
    const client = await db.connect();

    try {
      await client.query("begin");

      await client.query(
        `
          insert into public.sensor_devices (device_id, last_seen_at, last_battery)
          values ($1, $2, $3)
          on conflict (device_id) do update set
            last_seen_at = greatest(public.sensor_devices.last_seen_at, excluded.last_seen_at),
            last_battery = excluded.last_battery,
            updated_at = now()
        `,
        [payload.deviceId, payload.recordedAt, payload.battery],
      );

      const insertResult = await client.query<{ id: string }>(
        `
          insert into public.sensor_readings (
            device_id,
            temperature,
            humidity,
            wind_speed,
            battery,
            recorded_at
          )
          values ($1, $2, $3, $4, $5, $6)
          on conflict (device_id, recorded_at) do update set
            temperature = excluded.temperature,
            humidity = excluded.humidity,
            wind_speed = excluded.wind_speed,
            battery = excluded.battery,
            received_at = now()
          returning id::text
        `,
        [
          payload.deviceId,
          payload.temperature,
          payload.humidity,
          payload.windSpeed,
          payload.battery,
          payload.recordedAt,
        ],
      );

      await client.query("commit");

      return Response.json(
        {
          ok: true,
          reading_id: insertResult.rows[0]?.id,
          device_id: payload.deviceId,
          recorded_at: payload.recordedAt.toISOString(),
        },
        { status: 201 },
      );
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Unable to ingest sensor payload", error);
    return Response.json(
      { ok: false, error: "Unable to save sensor reading" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const db = getPool();

  if (!db) {
    return Response.json(
      { ok: false, error: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await db.query(`
      select
        r.id::text,
        r.device_id,
        r.temperature,
        r.humidity,
        r.wind_speed,
        r.battery,
        r.recorded_at,
        r.received_at
      from public.sensor_readings r
      order by r.recorded_at desc, r.received_at desc
      limit 50
    `);

    return Response.json({ ok: true, readings: result.rows });
  } catch (error) {
    console.error("Unable to load sensor readings", error);
    return Response.json(
      { ok: false, error: "Unable to load sensor readings" },
      { status: 500 },
    );
  }
}
