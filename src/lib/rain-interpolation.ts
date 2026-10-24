import type { BasinBoundary } from "./basin-boundaries";

export type RainMethod = "tps" | "idw";
type XY = [number, number];
type RainSample = {
  id: string; lat: number | null; lng: number | null; rainfallMm: number | null;
  observedAt: string; accumulationHours?: number;
};
export type RainPoint = { id: string; xy: XY; value: number; time: number };
export type RainSelection = { points: RainPoint[]; total: number; from: number | null; to: number | null };
export type RainSurfaceStatus = {
  state: "ready" | "boundary" | "insufficient" | "error";
  used: number; total: number; coverage: number; from: number | null; to: number | null;
};
export const RAIN_POLICY = { maxAgeHours: 2, maxSkewMinutes: 60, maxDistanceKm: 15, smoothing: .01, scaleKm: 50 } as const;
export const RAIN_COLORS = [
  [0, "#eaf3f8"], [.1, "#cee8f5"], [1, "#a1d5ee"], [5, "#6bbde1"],
  [10, "#389dcc"], [30, "#187bb5"], [60, "#0c5e98"], [90, "#084b80"], [150, "#06365e"],
] as const;

// Local distances in km, rather than treating longitude and latitude as equal units.
export function projectRain(lng: number, lat: number): XY {
  return [(lng - 99.9) * 111.195 * Math.cos(7.8 * Math.PI / 180), (lat - 7.8) * 111.195];
}
const distance = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function rainHull(points: XY[]): XY[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (items: XY[]) => {
    const edge: XY[] = [];
    for (const p of items) {
      while (edge.length > 1 && cross(edge[edge.length - 2], edge[edge.length - 1], p) <= 1e-9) edge.pop();
      edge.push(p);
    }
    return edge.slice(0, -1);
  };
  return sorted.length < 3 ? [] : [...half(sorted), ...half([...sorted].reverse())];
}

export function selectRainPoints(stations: readonly RainSample[], now: number): RainSelection {
  const latest = new Map<string, RainPoint>();
  for (const station of stations) {
    const raw = station.observedAt.trim().replace(" ", "T");
    const time = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}+07:00`);
    const value = station.rainfallMm;
    if (station.accumulationHours !== 24 || value === null || !Number.isFinite(value) || value < 0 || value > 1000
      || station.lat === null || station.lng === null || !Number.isFinite(station.lat) || !Number.isFinite(station.lng)
      || Math.abs(station.lat) > 85 || Math.abs(station.lng) > 180 || !Number.isFinite(time)
      || time > now + 5 * 60000 || now - time > RAIN_POLICY.maxAgeHours * 3600000) continue;
    const previous = latest.get(station.id);
    if (!previous || time > previous.time) latest.set(station.id, { id: station.id, xy: projectRain(station.lng, station.lat), value, time });
  }
  // Choose the largest cohort whose 24-hour totals end within one hour of each other.
  // On ties prefer the most recent cohort.
  const candidates = [...latest.values()].sort((a, b) => a.time - b.time);
  let cohort: RainPoint[] = [];
  for (const candidate of candidates) {
    const group = candidates.filter(point => point.time >= candidate.time && point.time - candidate.time <= RAIN_POLICY.maxSkewMinutes * 60000);
    if (group.length >= cohort.length) cohort = group;
  }
  const points: RainPoint[] = [];
  for (const point of cohort) {
    if (!points.some(other => distance(other.xy, point.xy) < .001)) points.push(point);
  }
  return { points, total: stations.length, from: points.length ? Math.min(...points.map(p => p.time)) : null, to: points.length ? Math.max(...points.map(p => p.time)) : null };
}

function solve(matrix: number[][], values: number[]) {
  const n = values.length, a = matrix.map((row, i) => [...row, values[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error("สถานีไม่เพียงพอหรือระบบสมการไม่เสถียร");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  const solution = Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = a[row][n];
    for (let col = row + 1; col < n; col++) sum -= a[row][col] * solution[col];
    solution[row] = sum / a[row][row];
  }
  return solution;
}
const kernel = (r: number) => r > 0 ? r * r * Math.log(r) : 0;

export function createRainModel(points: RainPoint[], method: RainMethod, smoothing: number = RAIN_POLICY.smoothing): (xy: XY) => number {
  if (points.length < 3 || rainHull(points.map(p => p.xy)).length < 3) throw new Error("ต้องมีอย่างน้อย 3 สถานีที่ไม่อยู่บนเส้นตรงเดียวกัน");
  if (method === "idw") return xy => {
    let sum = 0, weights = 0;
    for (const point of points) {
      const d = distance(xy, point.xy);
      if (d < 1e-8) return point.value;
      const weight = 1 / (d * d);
      sum += weight * point.value; weights += weight;
    }
    return sum / weights;
  };
  // TPS: r² log(r) kernel plus an affine polynomial and Pᵀa = 0 constraints.
  // log1p rain, 50 km coordinate scaling and smoothing follow the reference map.
  const coords = points.map(p => p.xy.map(v => v / RAIN_POLICY.scaleKm) as XY);
  const n = points.length, matrix = Array.from({ length: n + 3 }, () => Array<number>(n + 3).fill(0));
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) matrix[row][col] = kernel(distance(coords[row], coords[col])) + (row === col ? smoothing : 0);
    [1, ...coords[row]].forEach((value, k) => { matrix[row][n + k] = value; matrix[n + k][row] = value; });
  }
  const coefficients = solve(matrix, [...points.map(p => Math.log1p(p.value)), 0, 0, 0]);
  const max = Math.max(...points.map(p => p.value));
  return xy => {
    const q = xy.map(value => value / RAIN_POLICY.scaleKm) as XY;
    let z = coefficients[n] + coefficients[n + 1] * q[0] + coefficients[n + 2] * q[1];
    coords.forEach((point, i) => { z += coefficients[i] * kernel(distance(q, point)); });
    return Math.max(0, Math.min(max, Math.expm1(z)));
  };
}

type Ring = number[][];
function inRing([x, y]: XY, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export type RainGrid = {
  width: number; height: number; bounds: { west: number; east: number; north: number; south: number };
  cells: Float32Array; mask: Uint8Array; coverage: number;
};
export function buildRainGrid(boundary: BasinBoundary, points: RainPoint[], method: RainMethod, width = 180): RainGrid {
  const polygons = boundary.features.flatMap(feature => feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates);
  const coords = polygons.flat(2);
  if (!coords.length) throw new Error("ไม่มีขอบเขตลุ่มน้ำ");
  const bounds = { west: Math.min(...coords.map(p => p[0])), east: Math.max(...coords.map(p => p[0])), north: Math.max(...coords.map(p => p[1])), south: Math.min(...coords.map(p => p[1])) };
  if (!(bounds.east > bounds.west && bounds.north > bounds.south)) throw new Error("ขอบเขตลุ่มน้ำไม่ถูกต้อง");
  // ImageOverlay stretches in Web Mercator, so sample the same vertical projection.
  const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const top = mercator(bounds.north), bottom = mercator(bounds.south);
  const height = Math.max(24, Math.min(360, Math.round(width * (top - bottom) / ((bounds.east - bounds.west) * Math.PI / 180))));
  const cells = new Float32Array(width * height).fill(NaN), mask = new Uint8Array(cells.length);
  const hull = rainHull(points.map(p => p.xy)), predict = createRainModel(points, method);
  let total = 0, covered = 0;
  for (let y = 0; y < height; y++) {
    const lat = (2 * Math.atan(Math.exp(top - (y + .5) / height * (top - bottom))) - Math.PI / 2) * 180 / Math.PI;
    for (let x = 0; x < width; x++) {
      const lng = bounds.west + (x + .5) / width * (bounds.east - bounds.west), index = y * width + x;
      const geo: XY = [lng, lat];
      if (!polygons.some(polygon => inRing(geo, polygon[0]) && !polygon.slice(1).some(hole => inRing(geo, hole)))) continue;
      mask[index] = 1; total++;
      const xy = projectRain(lng, lat);
      if (!hull.every((p, i) => cross(p, hull[(i + 1) % hull.length], xy) >= -1e-8)
        || Math.min(...points.map(p => distance(xy, p.xy))) > RAIN_POLICY.maxDistanceKm) continue;
      const value = predict(xy);
      if (Number.isFinite(value)) { cells[index] = value; covered++; }
    }
  }
  return { width, height, bounds, cells, mask, coverage: total ? covered / total : 0 };
}

export function rainColor(value: number): [number, number, number] {
  let lower: readonly [number, string] = RAIN_COLORS[0], upper: readonly [number, string] = RAIN_COLORS[RAIN_COLORS.length - 1];
  for (let i = 1; i < RAIN_COLORS.length; i++) {
    if (value <= RAIN_COLORS[i][0]) { lower = RAIN_COLORS[i - 1]; upper = RAIN_COLORS[i]; break; }
  }
  const amount = Math.max(0, Math.min(1, (value - lower[0]) / (upper[0] - lower[0])));
  return [1, 3, 5].map(i => Math.round(parseInt(lower[1].slice(i, i + 2), 16) * (1 - amount) + parseInt(upper[1].slice(i, i + 2), 16) * amount)) as [number, number, number];
}
