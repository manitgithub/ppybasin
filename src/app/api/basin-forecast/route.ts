import { DAILY_FORECAST_API, FORECAST_REFERENCE, parseDailyForecast, parseTmdForecast, type BasinForecast } from "@/lib/forecast/basin";

async function json(url: string) {
  const response = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(25000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Forecast upstream unavailable");
  return response.json();
}
export async function GET() {
  const [daily, tmd] = await Promise.allSettled([
    json(DAILY_FORECAST_API).then(payload => parseDailyForecast(payload)),
    json(`${FORECAST_REFERENCE}/api/tmd/series`).then(parseTmdForecast),
  ]);
  const payload: BasinForecast = { checkedAt: new Date().toISOString(), daily: daily.status === "fulfilled" ? daily.value : null,
    tmd: tmd.status === "fulfilled" ? tmd.value : null, errors: {} };
  if (daily.status === "rejected") payload.errors.daily = "ยังอ่านพยากรณ์รายวันจาก สสน. ไม่ได้ กรุณาลองอัปเดตอีกครั้ง";
  if (tmd.status === "rejected") payload.errors.tmd = "ยังอ่านชุดพยากรณ์ TMD ที่บันทึกไว้ไม่ได้ กรุณาลองอัปเดตอีกครั้ง";
  return Response.json(payload, { status: !payload.daily && !payload.tmd ? 502 : 200, headers: { "Cache-Control": "no-store" } });
}
