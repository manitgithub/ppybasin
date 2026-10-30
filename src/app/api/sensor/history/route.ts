import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deviceId = new URL(request.url).searchParams.get("device_id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(deviceId)) {
    return Response.json({ ok: false, error: "Invalid device_id" }, { status: 400 });
  }
  const db = getPool();
  if (!db) return Response.json({ ok: false, error: "Database unavailable" }, { status: 503 });
  try {
    const result = await db.query(`
      select recorded_at, water_level::double precision as water_level
      from public.sensor_readings
      where device_id = $1 and water_level is not null
      order by recorded_at desc, received_at desc, id desc
      limit 50
    `, [deviceId]);
    return Response.json({ ok: true, readings: result.rows.reverse() });
  } catch (error) {
    console.error("Unable to load station water history", error);
    return Response.json({ ok: false, error: "Unable to load water history" }, { status: 500 });
  }
}
