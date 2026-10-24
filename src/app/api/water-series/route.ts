import { parseWaterSeries, WATER_REFERENCE, waterStations } from "@/lib/water/series";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const station = waterStations.find(item => item.code === params.get("station"));
  const days = Number(params.get("days") ?? 7);
  if (!station || ![1, 2, 3, 7, 30, 90, 180].includes(days)) return Response.json({ error: "สถานีหรือช่วงเวลาไม่ถูกต้อง" }, { status: 400 });
  try {
    const url = `${WATER_REFERENCE}/api/water-series?station=${encodeURIComponent(station.code)}&days=${days}`;
    const response = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(50000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Upstream unavailable");
    const payload = parseWaterSeries(await response.json(), station, days);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "เชื่อมต่อข้อมูลประวัติไม่สำเร็จ กรุณาลองอัปเดตอีกครั้ง" }, { status: 502 });
  }
}
