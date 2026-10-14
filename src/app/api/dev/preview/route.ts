import { cookies } from "next/headers";
import { allowsLocalPreview, LOCAL_PREVIEW_COOKIE } from "@/lib/local-preview";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!allowsLocalPreview(process.env.NODE_ENV, request.headers.get("host") ?? url.host, request.headers.get("x-forwarded-host"))) {
    return new Response(null, { status: 404 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return new Response(null, { status: 403 });
  const mode = (await request.formData()).get("mode");
  if (mode !== "guest" && mode !== "logged-in") return Response.json({ error: "Invalid preview mode" }, { status: 400 });
  (await cookies()).set(LOCAL_PREVIEW_COOKIE, mode, { httpOnly: true, sameSite: "strict", path: "/" });
  return new Response(null, { status: 303, headers: { Location: "/#home", "Cache-Control": "no-store" } });
}
