import { cookies } from "next/headers";
import { getActualUser } from "@/lib/auth";
import { availableViewRoles, isUserRole, VIEW_AS_COOKIE } from "@/lib/view-as";
import { isSameOriginRequest } from "@/lib/same-origin";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

/** Switch which role the signed-in account previews. Only roles at or below the real role are accepted. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return fail("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
  const user = await getActualUser();
  if (!user) return fail("กรุณาเข้าสู่ระบบ", 401);
  let body: { role?: unknown };
  try { body = await request.json(); } catch { return fail("ข้อมูลไม่ถูกต้อง", 400); }
  if (!isUserRole(body.role) || !availableViewRoles(user.role).includes(body.role)) return fail("บัญชีนี้ไม่มีสิทธิ์ดูในมุมมองนี้", 403);
  const store = await cookies();
  if (body.role === user.role) store.delete(VIEW_AS_COOKIE);
  else store.set(VIEW_AS_COOKIE, body.role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8, secure: process.env.NODE_ENV === "production" });
  return Response.json({ ok: true, role: body.role });
}
