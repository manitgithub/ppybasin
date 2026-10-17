import { publicCctvCamera } from "@/lib/cctv-stations";
import { getRidCameraStatus } from "@/lib/rid-cctv";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ camera: string }> }) {
  const { camera } = await params;
  if (publicCctvCamera(camera)?.station.provider !== "rid") return new Response(null, { status: 404 });
  try {
    return Response.json(await getRidCameraStatus(camera), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "ยังตรวจสอบเวลาภาพจากกรมชลประทานไม่ได้" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
