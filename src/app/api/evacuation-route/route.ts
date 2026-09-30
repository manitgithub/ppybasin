type Coordinate = [number, number];

type RouteRequest = {
  start?: unknown;
  destination?: unknown;
  floodArea?: unknown;
  floodAreas?: unknown;
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: Coordinate[]; type: "LineString" };
};

type RouteCandidate = {
  route: OsrmRoute;
  kind: "direct" | "detour";
};

function coordinate(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

function pointInPolygon(point: Coordinate, polygon: Coordinate[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, y] = point;
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientation(a: Coordinate, b: Coordinate, c: Coordinate) {
  return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
}

function segmentsIntersect(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return (first > 0) !== (second > 0) && (third > 0) !== (fourth > 0);
}

function routeTouchesFlood(route: OsrmRoute, floodAreas: Coordinate[][]) {
  const routePoints = route.geometry.coordinates.map(([lng, lat]): Coordinate => [lat, lng]);
  return floodAreas.some((area) => {
    if (routePoints.some((point) => pointInPolygon(point, area))) return true;

    for (let routeIndex = 1; routeIndex < routePoints.length; routeIndex += 1) {
      for (let areaIndex = 0; areaIndex < area.length; areaIndex += 1) {
        const nextAreaIndex = (areaIndex + 1) % area.length;
        if (segmentsIntersect(routePoints[routeIndex - 1], routePoints[routeIndex], area[areaIndex], area[nextAreaIndex])) {
          return true;
        }
      }
    }
    return false;
  });
}

function coordinateDistanceSquared(a: Coordinate, b: Coordinate) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

function orderCorridorFromStart(corridor: Coordinate[], start: Coordinate) {
  return coordinateDistanceSquared(start, corridor[0]) <= coordinateDistanceSquared(start, corridor[corridor.length - 1])
    ? corridor
    : [...corridor].reverse();
}

async function fetchRoutes(points: Coordinate[], alternatives: boolean) {
  const path = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?alternatives=${alternatives}&overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "SMART-BASIN-Evacuation/1.0" } });
  if (!response.ok) return [];
  const payload = await response.json() as { code?: string; routes?: OsrmRoute[] };
  return payload.code === "Ok" ? payload.routes ?? [] : [];
}

export async function POST(request: Request) {
  let body: RouteRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const start = coordinate(body.start);
  const destination = coordinate(body.destination);
  const legacyFloodArea = Array.isArray(body.floodArea) ? body.floodArea.map(coordinate).filter((item): item is Coordinate => item !== null) : [];
  const floodAreas = Array.isArray(body.floodAreas)
    ? body.floodAreas
      .filter(Array.isArray)
      .map((area) => area.map(coordinate).filter((item): item is Coordinate => item !== null))
      .filter((area) => area.length >= 3)
    : legacyFloodArea.length >= 3 ? [legacyFloodArea] : [];
  if (!start || !destination) return Response.json({ ok: false, error: "Invalid coordinates" }, { status: 422 });

  try {
    const directRoutes = await fetchRoutes([start, destination], true);
    const candidates: RouteCandidate[] = directRoutes.map((route) => ({ route, kind: "direct" }));

    const fastestDirect = [...directRoutes].sort((a, b) => a.duration - b.duration)[0];
    const blockingAreas = fastestDirect
      ? floodAreas.filter((area) => routeTouchesFlood(fastestDirect, [area]))
      : floodAreas;

    if (blockingAreas.length) {
      const lats = blockingAreas.flat().map(([lat]) => lat);
      const lngs = blockingAreas.flat().map(([, lng]) => lng);
      const rawMinLat = Math.min(...lats);
      const rawMaxLat = Math.max(...lats);
      const rawMinLng = Math.min(...lngs);
      const rawMaxLng = Math.max(...lngs);
      const margin = Math.max(0.0025, Math.max(rawMaxLat - rawMinLat, rawMaxLng - rawMinLng) * 0.12);
      const minLat = rawMinLat - margin;
      const maxLat = rawMaxLat + margin;
      const minLng = rawMinLng - margin;
      const maxLng = rawMaxLng + margin;
      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const detourOptions: Coordinate[][] = [
        [[maxLat, midLng]],
        [[minLat, midLng]],
        [[midLat, minLng]],
        [[midLat, maxLng]],
        [[maxLat, minLng], [maxLat, maxLng]],
        [[minLat, minLng], [minLat, maxLng]],
        [[minLat, minLng], [maxLat, minLng]],
        [[minLat, maxLng], [maxLat, maxLng]],
      ];
      const detours = detourOptions.map((corridor) => orderCorridorFromStart(corridor, start));
      const detourRoutes = await Promise.all(
        detours.map((waypoints) => fetchRoutes([start, ...waypoints, destination], false)),
      );
      candidates.push(...detourRoutes.flat().map((route) => ({ route, kind: "detour" as const })));

      const hasNearbySafeRoute = candidates.some((candidate) => !routeTouchesFlood(candidate.route, floodAreas));
      if (!hasNearbySafeRoute) {
        const expandedMargin = Math.max(0.01, Math.max(rawMaxLat - rawMinLat, rawMaxLng - rawMinLng) * 0.35);
        const expandedMinLat = rawMinLat - expandedMargin;
        const expandedMaxLat = rawMaxLat + expandedMargin;
        const expandedMinLng = rawMinLng - expandedMargin;
        const expandedMaxLng = rawMaxLng + expandedMargin;
        const expandedOptions: Coordinate[][] = [
          [[expandedMaxLat, expandedMinLng], [expandedMaxLat, expandedMaxLng]],
          [[expandedMinLat, expandedMinLng], [expandedMinLat, expandedMaxLng]],
          [[expandedMinLat, expandedMinLng], [expandedMaxLat, expandedMinLng]],
          [[expandedMinLat, expandedMaxLng], [expandedMaxLat, expandedMaxLng]],
        ];
        const expandedRoutes = await Promise.all(
          expandedOptions
            .map((corridor) => orderCorridorFromStart(corridor, start))
            .map((waypoints) => fetchRoutes([start, ...waypoints, destination], false)),
        );
        candidates.push(...expandedRoutes.flat().map((route) => ({ route, kind: "detour" as const })));
      }
    }

    if (!candidates.length) return Response.json({ ok: false, error: "No route found" }, { status: 404 });

    const ranked = candidates
      .map((candidate) => ({ ...candidate, intersectsFlood: floodAreas.length > 0 && routeTouchesFlood(candidate.route, floodAreas) }))
      .sort((a, b) => Number(a.intersectsFlood) - Number(b.intersectsFlood) || a.route.duration - b.route.duration || a.route.distance - b.route.distance);
    const selected = ranked[0];
    const safeAlternatives = ranked.filter((candidate) => !candidate.intersectsFlood).length;

    return Response.json({
      ok: true,
      route: selected.route,
      avoidsFlood: !selected.intersectsFlood,
      detourApplied: selected.kind === "detour",
      safeAlternatives,
      alternativesChecked: ranked.length,
      provider: "OSRM",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to calculate evacuation route", error);
    return Response.json({ ok: false, error: "Routing service unavailable" }, { status: 502 });
  }
}
