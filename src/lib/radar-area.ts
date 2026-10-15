import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export const RADAR_ANALYSIS_ZOOM = 7;
export const RADAR_ANALYSIS_SIZE = 512;
const WORLD_SIZE = RADAR_ANALYSIS_SIZE * 2 ** RADAR_ANALYSIS_ZOOM;

type Point = [number, number];
type Sample = { offset: number; weight: number };
export type BasinTile = { x: number; y: number; samples: Sample[] };
export type RadarAreaResult = { rainPercent: number | null; coveragePercent: number; samplePixels: number };

function project([lng, lat]: Position): Point {
  const sin = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * WORLD_SIZE, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * WORLD_SIZE];
}

function inRing(x: number, y: number, ring: Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function basinPixelSamples(boundary: FeatureCollection<Polygon | MultiPolygon>): BasinTile[] {
  const polygons = boundary.features.flatMap(({ geometry }) => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates)
    .map((polygon) => polygon.map((ring) => ring.map(project)));
  const points = polygons.flatMap((polygon) => polygon[0]);
  if (!points.length || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) throw new Error("Invalid basin boundary");
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  if ((maxX - minX) * (maxY - minY) > 100_000) throw new Error("Boundary too large");
  const tiles = new Map<string, BasinTile>();
  // Subsample boundary pixels; cos²(latitude) corrects Mercator pixel area.
  for (let y = minY; y < maxY; y++) {
    const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / WORLD_SIZE)));
    const groundWeight = Math.cos(latitude) ** 2 / 16;
    for (let x = minX; x < maxX; x++) {
      let weight = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4;
        const py = y + (sy + 0.5) / 4;
        if (polygons.some((rings) => inRing(px, py, rings[0]) && !rings.slice(1).some((ring) => inRing(px, py, ring)))) weight += groundWeight;
      }
      if (!weight) continue;
      const tx = Math.floor(x / RADAR_ANALYSIS_SIZE), ty = Math.floor(y / RADAR_ANALYSIS_SIZE);
      const key = `${tx}/${ty}`;
      if (!tiles.has(key)) tiles.set(key, { x: tx, y: ty, samples: [] });
      tiles.get(key)!.samples.push({ offset: ((y % RADAR_ANALYSIS_SIZE) * RADAR_ANALYSIS_SIZE + x % RADAR_ANALYSIS_SIZE) * 4, weight });
    }
  }
  return [...tiles.values()];
}

export function analyzeRadarPixels(tiles: Array<{ samples: Sample[]; radar: Uint8ClampedArray; coverage: Uint8ClampedArray }>): RadarAreaResult {
  let total = 0, covered = 0, rainy = 0, samplePixels = 0;
  for (const tile of tiles) {
    if (tile.radar.length !== RADAR_ANALYSIS_SIZE ** 2 * 4 || tile.coverage.length !== tile.radar.length) throw new Error("Invalid radar image size");
    for (const { offset, weight } of tile.samples) {
      samplePixels++;
      total += weight;
      // Coverage mask: transparent = covered, opaque/partial = unknown.
      if (tile.coverage[offset + 3] !== 0) continue;
      covered += weight;
      // Universal Blue is fully opaque from 15 dBZ; weaker echoes are translucent.
      // Use unsmoothed source tiles, independent of the map's display opacity.
      if (tile.radar[offset + 3] === 255) rainy += weight;
    }
  }
  if (!total) throw new Error("No basin pixels");
  return { rainPercent: covered ? rainy / covered * 100 : null, coveragePercent: covered / total * 100, samplePixels };
}
