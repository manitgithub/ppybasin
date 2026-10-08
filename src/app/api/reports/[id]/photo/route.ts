import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { canManageReports, isUuid } from "@/lib/reports";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await context.params;
  if (!isUuid(id)) return new Response(null, { status: 404 });
  const photoId = new URL(request.url).searchParams.get("photoId");
  if (photoId !== null && !isUuid(photoId)) return new Response(null, { status: 404 });
  const db = getPool();
  if (!db) return new Response(null, { status: 503 });
  try {
    const result = await db.query(`select p.data, p.content_type from public.citizen_report_photos p
      join public.citizen_reports r on r.id = p.report_id
      where r.id = $1 and ($2::boolean or r.reporter_id = $3::uuid)
      and ($4::uuid is null or p.id = $4::uuid) order by p.sort_order limit 1`, [id, canManageReports(user), isUuid(user.id) ? user.id : null, photoId]);
    if (!result.rows[0]) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(result.rows[0].data), { headers: { "Content-Type": result.rows[0].content_type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch { return new Response(null, { status: 503 }); }
}
