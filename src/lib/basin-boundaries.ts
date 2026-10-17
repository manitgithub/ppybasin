import { difference, type Polygon } from "polygon-clipping";
import type { FeatureCollection, MultiPolygon, Polygon as GeoPolygon } from "geojson";

export type BasinBoundary = FeatureCollection<GeoPolygon | MultiPolygon>;

export function combineBasinBoundaries(boundaries: readonly BasinBoundary[]): BasinBoundary | null {
  const features = boundaries.flatMap(boundary => boundary.features);
  return features.length ? { type: "FeatureCollection", features } : null;
}

// Subtract the selected basins together: overlapping areas stay clear, rather
// than becoming shaded again through an even/odd mask with overlapping holes.
export function basinOutsideMask(boundary: BasinBoundary | null): FeatureCollection<MultiPolygon> | null {
  if (!boundary?.features.length) return null;
  const polygons: Polygon[] = boundary.features.flatMap(({ geometry }) =>
    (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates)
      .map(polygon => polygon.map(ring => ring.map(([lng, lat]) => [lng, lat] as [number, number]))));
  const world: Polygon = [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]];
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: difference(world, ...polygons) } }] };
}
