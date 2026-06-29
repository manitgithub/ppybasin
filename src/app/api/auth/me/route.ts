import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
}
