export type RoadClosure = {
  id: string; name: string; description: string;
  aLat: number; aLng: number; bLat: number; bLng: number;
  createdAt: string;
};
export const roadClosureSelect = `select id, name, description, a_lat as "aLat", a_lng as "aLng", b_lat as "bLat", b_lng as "bLng", created_at as "createdAt" from public.road_closures where reopened_at is null`;
export function validateRoadClosure(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const v = body as Record<string, unknown>;
  if (typeof v.name !== "string" || v.name.trim().length < 3 || v.name.trim().length > 150 || typeof v.description !== "string" || v.description.trim().length < 5 || v.description.trim().length > 2000) return null;
  for (const key of ["aLat", "aLng", "bLat", "bLng"]) {
    if (typeof v[key] !== "number" || !Number.isFinite(v[key]) || Math.abs(v[key] as number) > (key.endsWith("Lat") ? 90 : 180)) return null;
  }
  if (v.aLat === v.bLat && v.aLng === v.bLng) return null;
  return { name: v.name.trim(), description: v.description.trim(), aLat: v.aLat as number, aLng: v.aLng as number, bLat: v.bLat as number, bLng: v.bLng as number };
}
