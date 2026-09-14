import { getForecastData } from "@/lib/forecast/adapters";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getForecastData();

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
