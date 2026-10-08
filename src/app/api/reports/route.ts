import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { LOCAL_PREVIEW_LINE_ID, LOCAL_PREVIEW_USER_ID } from "@/lib/local-preview";
import { MAX_REPORT_PHOTOS, MAX_REPORT_PHOTO_BYTES, MAX_REPORT_PHOTOS_BYTES, canCreateReports, canManageReports, isUuid, reportSelect, validateReport } from "@/lib/reports";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("กรุณาเข้าสู่ระบบเพื่อดูรายงานของคุณ", 401);
  const db = getPool();
  if (!db) return fail("ระบบรับรายงานยังไม่พร้อมใช้งาน", 503);
  try {
    const result = await db.query(`${reportSelect} where ($1::boolean or r.reporter_id = $2::uuid) order by r.created_at desc limit 100`, [canManageReports(user), isUuid(user.id) ? user.id : null]);
    return Response.json({ ok: true, reports: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load citizen reports", error);
    return fail("โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง", 503);
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
  const user = await getCurrentUser();
  if (!user) return fail("กรุณาเข้าสู่ระบบก่อนส่งรายงาน", 401);
  if (!canCreateReports(user)) return fail("บัญชีนี้ไม่มีสิทธิ์ส่งรายงาน", 403);
  if (!isUuid(user.id)) return fail("ใช้บัญชี LINE จริงเพื่อส่งรายงาน บัญชีจำลองไม่บันทึกข้อมูล", 403);
  const maxBodyBytes = MAX_REPORT_PHOTOS_BYTES + 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maxBodyBytes) return fail("รูปทั้งหมดรวมกันต้องไม่เกิน 20 MB", 413);
  let form: FormData;
  try {
    const reader = request.body?.getReader();
    if (!reader) return fail("อ่านข้อมูลแบบฟอร์มไม่สำเร็จ", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBodyBytes) { await reader.cancel(); return fail("รูปทั้งหมดรวมกันต้องไม่เกิน 20 MB", 413); }
      chunks.push(chunk.value);
    }
    form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { return fail("อ่านข้อมูลแบบฟอร์มไม่สำเร็จ", 400); }
  const validation = validateReport(form);
  if (!validation.value) return fail(validation.error!, 422);
  const v = validation.value;
  // Accept the previous single-photo field as well as the new repeated photos field.
  const entries = [...form.getAll("photos"), ...form.getAll("photo")];
  if (entries.some((entry) => !(entry instanceof File))) return fail("ข้อมูลรูปถ่ายไม่ถูกต้อง", 422);
  const files = entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_REPORT_PHOTOS) return fail(`แนบได้สูงสุด ${MAX_REPORT_PHOTOS} รูป`, 422);
  if (files.reduce((total, file) => total + file.size, 0) > MAX_REPORT_PHOTOS_BYTES) return fail("รูปทั้งหมดรวมกันต้องไม่เกิน 20 MB", 413);
  const photos: { data: Buffer; contentType: string; filename: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_REPORT_PHOTO_BYTES) return fail("แต่ละรูปต้องมีขนาดไม่เกิน 5 MB", 413);
    const data = Buffer.from(await file.arrayBuffer());
    let contentType = "";
    if (data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) contentType = "image/jpeg";
    else if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) contentType = "image/png";
    else if (data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP") contentType = "image/webp";
    else return fail("รองรับรูป JPG, PNG หรือ WebP เท่านั้น", 422);
    photos.push({ data, contentType, filename: file.name.slice(0, 150) || "ภาพประกอบ" });
  }
  const db = getPool();
  if (!db) return fail("ระบบรับรายงานยังไม่พร้อมใช้งาน ข้อมูลยังไม่ได้ส่ง", 503);
  const client = await db.connect().catch(() => null);
  if (!client) return fail("เชื่อมต่อระบบไม่ได้ ข้อมูลยังไม่ได้ส่ง", 503);
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [user.id]);
    const duplicate = await client.query("select id from public.citizen_reports where reporter_id = $1 and submission_key = $2", [user.id, v.submissionKey]);
    if (duplicate.rows[0]) {
      await client.query("commit");
      return Response.json({ ok: true, id: duplicate.rows[0].id }, { status: 200 });
    }
    const count = await client.query("select count(*)::int as count from public.citizen_reports where reporter_id = $1 and created_at > now() - interval '10 minutes'", [user.id]);
    if (count.rows[0].count >= 5) {
      await client.query("rollback");
      return fail("ส่งรายงานหลายครั้งแล้ว กรุณารอ 10 นาที หรือโทรติดต่อหน่วยงานโดยตรง", 429);
    }
    if (user.id === LOCAL_PREVIEW_USER_ID && user.lineUserId === LOCAL_PREVIEW_LINE_ID) {
      await client.query(`insert into public.app_users(id, line_user_id, display_name, role, permissions)
        values ($1,$2,$3,'viewer','["dashboard:view","reports:create"]'::jsonb)
        on conflict (line_user_id) do nothing`, [user.id, user.lineUserId, user.displayName]);
    }
    const result = await client.query(`insert into public.citizen_reports
      (submission_key, reporter_id, kind, place, latitude, longitude, observed_at, passability, description, contact_name, contact_phone, people_count, needs, water_depth)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
      [v.submissionKey, user.id, v.kind, v.place, v.latitude, v.longitude, v.observedAt, v.passability, v.description, v.contactName, v.contactPhone, v.peopleCount, v.needs, v.waterDepth]);
    const id = result.rows[0].id;
    await client.query("insert into public.citizen_report_events(report_id, actor_id, status) values ($1,$2,'pending')", [id, user.id]);
    for (const [index, photo] of photos.entries()) {
      await client.query("insert into public.citizen_report_photos(report_id, content_type, data, filename, sort_order) values ($1,$2,$3,$4,$5)", [id, photo.contentType, photo.data, photo.filename, index]);
    }
    await client.query("commit");
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    await client.query("rollback");
    console.error("Unable to save citizen report", error);
    return fail("บันทึกรายงานไม่สำเร็จ ข้อมูลยังไม่ได้ส่ง กรุณาลองอีกครั้ง", 503);
  } finally { client.release(); }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
  const user = await getCurrentUser();
  if (!user || !canManageReports(user)) return fail("เฉพาะเจ้าหน้าที่ที่มีสิทธิ์จัดการรายงาน", 403);
  let body;
  try { body = await request.json(); } catch { return fail("ข้อมูลไม่ถูกต้อง", 400); }
  if (!body || typeof body !== "object" || typeof body.id !== "string" || !isUuid(body.id) || typeof body.status !== "string" || typeof body.note !== "string" || body.note.length > 1000) return fail("ข้อมูลไม่ถูกต้อง", 422);
  if (!isUuid(user.id)) return fail("บัญชีจำลองไม่สามารถเปลี่ยนสถานะรายงาน", 403);
  const transitions: Record<string, string[]> = { pending: ["verified", "rejected"], verified: ["in_progress", "resolved", "rejected"], in_progress: ["resolved"], resolved: [], rejected: [] };
  const db = getPool();
  if (!db) return fail("ระบบรับรายงานยังไม่พร้อม", 503);
  const client = await db.connect().catch(() => null);
  if (!client) return fail("เชื่อมต่อระบบไม่ได้", 503);
  try {
    await client.query("begin");
    const result = await client.query("select status from public.citizen_reports where id = $1 for update", [body.id]);
    if (!result.rows[0]) { await client.query("rollback"); return fail("ไม่พบรายงาน", 404); }
    if (!transitions[result.rows[0].status]?.includes(body.status)) { await client.query("rollback"); return fail("สถานะเปลี่ยนแล้ว หรือไม่สามารถเปลี่ยนตามลำดับนี้ได้ กรุณาโหลดใหม่", 409); }
    await client.query("update public.citizen_reports set status = $2, updated_at = now() where id = $1", [body.id, body.status]);
    await client.query("insert into public.citizen_report_events(report_id, actor_id, status, note) values ($1,$2,$3,$4)", [body.id, user.id, body.status, body.note.trim()]);
    await client.query("commit");
    return Response.json({ ok: true });
  } catch (error) {
    await client.query("rollback"); console.error("Unable to update citizen report", error);
    return fail("เปลี่ยนสถานะไม่สำเร็จ", 503);
  } finally { client.release(); }
}
