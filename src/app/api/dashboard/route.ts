import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getDashboardData();

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
