import { parseRainViewer } from "@/lib/rainviewer";

export async function GET() {
  try {
    const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("RainViewer unavailable");
    const data = parseRainViewer(await response.json());
    if (!data) throw new Error("No radar frames");
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch {
    return Response.json({ error: "ยังโหลดเรดาร์ RainViewer ไม่ได้" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
