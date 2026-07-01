import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type SensorRequestBody = {
  device_id?: unknown;
  temperature?: unknown;
  humidity?: unknown;
  wind_speed?: unknown;
  direction?: unknown;
  rainfall?: unknown;
  water_level?: unknown;
  battery?: unknown;
  battery_1?: unknown;
  battery_2?: unknown;
  packet_count?: unknown;
  heap?: unknown;
  timestamp?: unknown;
};

type ValidSensorPayload = {
  deviceId: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  direction: string | null;
  rainfall: number | null;
  waterLevel: number | null;
  battery: number;
  battery1: number | null;
  battery2: number | null;
  packetCount: number | null;
  heap: number | null;
  recordedAt: Date;
  rawPayload: SensorRequestBody;
};

function optionalNumber(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function optionalInteger(value: unknown) {
  const numeric = optionalNumber(value);

  if (numeric === null || typeof numeric === "undefined") {
    return numeric;
  }

  return Number.isInteger(numeric) ? numeric : undefined;
}

function validateSensorPayload(body: SensorRequestBody): { payload?: ValidSensorPayload; errors?: string[] } {
  const errors: string[] = [];
  const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
  const timestamp = typeof body.timestamp === "string" ? body.timestamp.trim() : "";
  const recordedAt = timestamp ? new Date(timestamp) : new Date();
  const direction = typeof body.direction === "string" ? body.direction.trim() : "";
  const temperature = optionalNumber(body.temperature);
  const humidity = optionalNumber(body.humidity);
  const windSpeed = optionalNumber(body.wind_speed);
  const rainfall = optionalNumber(body.rainfall);
  const waterLevel = optionalNumber(body.water_level);
  const battery1 = optionalNumber(body.battery_1);
  const battery2 = optionalNumber(body.battery_2);
  const battery = optionalNumber(body.battery) ?? battery1;
  const packetCount = optionalInteger(body.packet_count);
  const heap = optionalInteger(body.heap);

  if (!deviceId) {
    errors.push("device_id is required");
  } else if (!/^[A-Za-z0-9_-]{2,64}$/.test(deviceId)) {
    errors.push("device_id must be 2-64 characters and contain only letters, numbers, underscore, or dash");
  }

  if (temperature === undefined || temperature === null || temperature < -50 || temperature > 100) {
    errors.push("temperature must be a number between -50 and 100");
  }

  if (humidity === undefined || humidity === null || humidity < 0 || humidity > 100) {
    errors.push("humidity must be a number between 0 and 100");
  }

  if (windSpeed === undefined || windSpeed === null || windSpeed < 0 || windSpeed > 150) {
    errors.push("wind_speed must be a number between 0 and 150");
  }

  if (direction && direction.length > 32) {
    errors.push("direction must be 32 characters or less");
  }

  if (rainfall === undefined || (rainfall !== null && (rainfall < 0 || rainfall > 10000))) {
    errors.push("rainfall must be empty or a number between 0 and 10000");
  }

  if (waterLevel === undefined || (waterLevel !== null && (waterLevel < -100 || waterLevel > 1000))) {
    errors.push("water_level must be empty or a number between -100 and 1000");
  }

  if (battery === undefined || battery === null || battery < 0 || battery > 30) {
    errors.push("battery or battery_1 must be a number between 0 and 30");
  }

  if (battery1 === undefined || (battery1 !== null && (battery1 < 0 || battery1 > 30))) {
    errors.push("battery_1 must be empty or a number between 0 and 30");
  }

  if (battery2 === undefined || (battery2 !== null && (battery2 < 0 || battery2 > 30))) {
    errors.push("battery_2 must be empty or a number between 0 and 30");
  }

  if (packetCount === undefined || (packetCount !== null && packetCount < 0)) {
    errors.push("packet_count must be empty or a positive integer");
  }

  if (heap === undefined || (heap !== null && heap < 0)) {
    errors.push("heap must be empty or a positive integer");
  }

  if (timestamp && Number.isNaN(recordedAt.getTime())) {
    errors.push("timestamp must be a valid ISO 8601 datetime");
  }

  if (errors.length) {
    return { errors };
  }

  const normalizedBattery = battery ?? 0;

  return {
    payload: {
      deviceId,
      temperature: temperature ?? 0,
      humidity: humidity ?? 0,
      windSpeed: windSpeed ?? 0,
      direction: direction || null,
      rainfall: rainfall ?? null,
      waterLevel: waterLevel ?? null,
      battery: normalizedBattery,
      battery1: battery1 ?? normalizedBattery,
      battery2: battery2 ?? null,
      packetCount: packetCount ?? null,
      heap: heap ?? null,
      recordedAt,
      rawPayload: body,
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
            direction,
            rainfall,
            water_level,
            battery,
            battery_1,
            battery_2,
            packet_count,
            heap,
            recorded_at,
            raw_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          on conflict (device_id, recorded_at) do update set
            temperature = excluded.temperature,
            humidity = excluded.humidity,
            wind_speed = excluded.wind_speed,
            direction = excluded.direction,
            rainfall = excluded.rainfall,
            water_level = excluded.water_level,
            battery = excluded.battery,
            battery_1 = excluded.battery_1,
            battery_2 = excluded.battery_2,
            packet_count = excluded.packet_count,
            heap = excluded.heap,
            raw_payload = excluded.raw_payload,
            received_at = now()
          returning id::text
        `,
        [
          payload.deviceId,
          payload.temperature,
          payload.humidity,
          payload.windSpeed,
          payload.direction,
          payload.rainfall,
          payload.waterLevel,
          payload.battery,
          payload.battery1,
          payload.battery2,
          payload.packetCount,
          payload.heap,
          payload.recordedAt,
          payload.rawPayload,
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
        r.direction,
        r.rainfall,
        r.water_level,
        r.battery,
        r.battery_1,
        r.battery_2,
        r.packet_count,
        r.heap,
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
