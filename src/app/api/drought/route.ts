import { getDroughtData } from "@/lib/drought/adapters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const payload = await getDroughtData(new URL(request.url).searchParams.get("refresh") === "1");
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
