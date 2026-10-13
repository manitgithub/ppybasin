"use client";

import L from "leaflet";
import { memo, useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, ScaleControl, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { FeatureCollection, LineString, MultiPolygon, Polygon as GeoPolygon } from "geojson";

type WaterwayData = {
  waterways: Array<{ id: number; type: string; name: string; points: [number, number][] }>;
};

const center: [number, number] = [7.807, 100.025];
const paPhayomBounds: [[number, number], [number, number]] = [
  [7.72, 99.82],
  [7.89, 100.23],
];

type BasinBoundary = FeatureCollection<GeoPolygon | MultiPolygon>;

function BoundsUpdater({ boundary }: { boundary: BasinBoundary | null }) {
  const map = useMap();

  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(boundary ? L.geoJSON(boundary).getBounds() : paPhayomBounds, {
        animate: false,
        padding: [32, 32],
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, boundary]);

  return null;
}

function BasinMap({ showWaterways = true }: { showWaterways?: boolean }) {
  const [boundary, setBoundary] = useState<BasinBoundary | null>(null);
  const [boundaryError, setBoundaryError] = useState(false);
  const [waterways, setWaterways] = useState<WaterwayData | null>(null);
  const [waterwaysError, setWaterwaysError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/terrain/pa-phayom-waterways.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Waterways unavailable");
        const result: WaterwayData = await response.json();
        if (!Array.isArray(result.waterways) || !result.waterways.length) throw new Error("Waterways missing");
        setWaterways(result);
      })
      .catch(() => { if (!controller.signal.aborted) setWaterwaysError(true); });
    return () => controller.abort();
  }, []);

  const waterwayLines = useMemo<FeatureCollection<LineString>>(() => ({
    type: "FeatureCollection",
    features: (waterways?.waterways ?? []).map((waterway) => ({
      type: "Feature",
      id: waterway.id,
      properties: { name: waterway.name, main: waterway.type === "river" || waterway.type === "canal" },
      geometry: { type: "LineString", coordinates: waterway.points },
    })),
  }), [waterways]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/boundaries/pa-phayom-basin.geojson", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Boundary unavailable");
        const result: BasinBoundary = await response.json();
        if (!result.features?.length) throw new Error("Boundary missing");
        setBoundary(result);
      })
      .catch(() => { if (!controller.signal.aborted) setBoundaryError(true); });
    return () => controller.abort();
  }, []);

  const outsideMask = useMemo<FeatureCollection<GeoPolygon> | null>(() => {
    if (!boundary) return null;
    const polygons = boundary.features.flatMap(({ geometry }) => geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);
    return {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...polygons.map((rings) => rings[0])] } },
        ...polygons.flatMap((rings) => rings.slice(1).map((ring) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring] } }))),
      ],
    };
  }, [boundary]);
  return (
    <>
    {boundaryError && <p role="status" className="absolute right-3 top-16 z-10 max-w-[240px] rounded bg-white p-3 text-xs text-slate-700">โหลดขอบเขตลุ่มน้ำไม่ได้ กรุณาโหลดหน้าใหม่</p>}
    {showWaterways && <p role="status" className="absolute bottom-20 right-3 z-10 max-w-[240px] rounded bg-white px-3 py-2 text-xs text-slate-700">
      {waterwaysError ? "โหลดเส้นทางน้ำไม่ได้ กรุณาโหลดหน้าใหม่" : waterways ? "ทางน้ำ: OpenStreetMap contributors" : "กำลังโหลดเส้นทางน้ำ…"}
    </p>}
    <MapContainer
      center={center}
      zoom={13}
      minZoom={9}
      maxZoom={16}
      zoomSnap={0.25}
      zoomControl={false}
      scrollWheelZoom
      className="z-0"
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), &copy; OpenStreetMap contributors, GIS User Community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
      />

      {outsideMask && <GeoJSON data={outsideMask} interactive={false} style={{ stroke: false, fillColor: "#203746", fillOpacity: .35, fillRule: "evenodd" }} />}
      {boundary && <>
        <GeoJSON data={boundary} interactive={false} style={{ color: "#f9fdff", weight: 5, opacity: .8, fill: false }} />
        <GeoJSON data={boundary} interactive={false} style={{ color: "#128b87", weight: 2, dashArray: "6 4", opacity: 1, fillColor: "#128b87", fillOpacity: .06 }} />
      </>}

      {showWaterways && waterways && <>
        <GeoJSON data={waterwayLines} interactive={false} style={(feature) => ({ color: "#ffffff", weight: feature?.properties?.main ? 7 : 4.5, opacity: .9, lineCap: "round", lineJoin: "round" })} />
        <GeoJSON data={waterwayLines} style={(feature) => ({ color: feature?.properties?.main ? "#006bb6" : "#149fda", weight: feature?.properties?.main ? 4 : 2.5, opacity: 1, lineCap: "round", lineJoin: "round" })}
          onEachFeature={(feature, layer) => {
            // Use textContent so names from the source cannot become HTML.
            const label = document.createElement("span");
            label.textContent = feature.properties?.name || (feature.properties?.main ? "แม่น้ำ / คลอง" : "ลำธาร / ทางน้ำย่อย");
            layer.bindTooltip(label, { sticky: true });
          }}
        />
      </>}

      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomleft" imperial={false} />
      <BoundsUpdater boundary={boundary} />
    </MapContainer>
    </>
  );
}

export default memo(BasinMap);
