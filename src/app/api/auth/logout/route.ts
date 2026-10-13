import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  // A relative redirect stays on the browser's origin, including behind a proxy.
  return new Response(null, {
    status: 303,
    headers: { Location: "/", "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return POST();
}
