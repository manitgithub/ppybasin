import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { canManageRoads, isUuid } from "@/lib/reports";
import { roadClosureSelect, validateRoadClosure } from "@/lib/road-closures";
import { isSameOriginRequest } from "@/lib/same-origin";
export const dynamic = "force-dynamic";
const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });
export async function GET() {
  const db = getPool();
  if (!db) return fail("ระบบข้อมูลปิดถนนยังไม่พร้อม", 503);
  try {
    const result = await db.query(`${roadClosureSelect} order by created_at desc`);
    return Response.json({ ok: true, closures: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail("โหลดข้อมูลปิดถนนไม่สำเร็จ", 503); }
}
async function mutate(request: Request, reopen: boolean) {
  if (!isSameOriginRequest(request)) return fail("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
  const user = await getCurrentUser();
  if (!user || !canManageRoads(user)) return fail("ต้องมีสิทธิ์อาสาสมัครหรือจัดการถนน", 403);
  if (!isUuid(user.id)) return fail("บัญชีจำลองไม่สามารถบันทึกข้อมูล", 403);
  let body;
  try { body = await request.json(); } catch { return fail("ข้อมูลไม่ถูกต้อง", 400); }
  const value = reopen ? null : validateRoadClosure(body);
  if (reopen ? !body || typeof body.id !== "string" || !isUuid(body.id) : !value) return fail("ระบุชื่อถนน รายละเอียด และพิกัด A–B ที่ต่างกันให้ครบ", 422);
  const db = getPool();
  if (!db) return fail("ระบบข้อมูลปิดถนนยังไม่พร้อม", 503);
  try {
    if (reopen) {
      const result = await db.query("update public.road_closures set reopened_at = now(), reopened_by = $2 where id = $1 and reopened_at is null returning id", [body.id, user.id]);
      if (!result.rows.length) return fail("ถนนนี้เปิดแล้วหรือไม่พบข้อมูล", 409);
      return Response.json({ ok: true });
    }
    const v = value!;
    const result = await db.query("insert into public.road_closures(reporter_id,name,description,a_lat,a_lng,b_lat,b_lng) values ($1,$2,$3,$4,$5,$6,$7) returning id", [user.id,v.name,v.description,v.aLat,v.aLng,v.bLat,v.bLng]);
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch { return fail("บันทึกข้อมูลปิดถนนไม่สำเร็จ", 503); }
}
export async function POST(request: Request) { return mutate(request, false); }
export async function PATCH(request: Request) { return mutate(request, true); }
