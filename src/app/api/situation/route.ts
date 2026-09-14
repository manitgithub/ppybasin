import { getSituationData } from "@/lib/situation/adapters";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getSituationData();

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
