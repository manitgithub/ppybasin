import { publicCctvCamera } from "@/lib/cctv-stations";

export async function GET(_request: Request, { params }: { params: Promise<{ camera: string }> }) {
  const { camera } = await params;
  const source = publicCctvCamera(camera);
  if (!source) return new Response(null, { status: 404 });
  try {
    // Public snapshots only: no authentication, tickets, or private streams.
    const response = await fetch(source.imageUrl, {
      next: { revalidate: 30 }, signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok || !/^image\/(jpeg|jpg)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) throw new Error("Snapshot unavailable");
    const body = await response.arrayBuffer();
    if (body.byteLength < 4 || body.byteLength > 5_000_000 || new Uint8Array(body)[0] !== 0xff || new Uint8Array(body)[1] !== 0xd8) throw new Error("Invalid JPEG");
    return new Response(body, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=15, s-maxage=30", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return Response.json({ error: `ยังโหลดภาพกล้องไม่ได้ กรุณาดูจากเว็บ ${source.station.providerLabel} หรือลองใหม่` }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
