"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { ImageOverlay, Pane, useMap } from "react-leaflet";
import type { BasinBoundary } from "@/lib/basin-boundaries";
import { buildRainGrid, rainColor, rainHull, selectRainPoints, type RainMethod, type RainSurfaceStatus } from "@/lib/rain-interpolation";
import type { RainStation } from "@/lib/situation/adapters";
import type { RegisteredRainStation } from "@/lib/rain-stations";

export default function RainSurfaceLayer({ stations, boundary, method, opacity, now, onStatus }: {
  stations: (RainStation | RegisteredRainStation)[]; boundary: BasinBoundary | null;
  method: RainMethod; opacity: number; now: number; onStatus?: (status: RainSurfaceStatus) => void;
}) {
  const map = useMap();
  const result = useMemo(() => {
    const selected = selectRainPoints(stations, now);
    const status: RainSurfaceStatus = { state: "boundary", used: selected.points.length, total: selected.total, coverage: 0, from: selected.from, to: selected.to };
    if (!boundary) return { status, grid: null, url: "" };
    if (selected.points.length < 3 || rainHull(selected.points.map(p => p.xy)).length < 3) return { status: { ...status, state: "insufficient" as const }, grid: null, url: "" };
    try {
      const grid = buildRainGrid(boundary, selected.points, method);
      const canvas = document.createElement("canvas"); canvas.width = grid.width; canvas.height = grid.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const pixels = context.createImageData(grid.width, grid.height);
      for (let i = 0; i < grid.cells.length; i++) {
        if (!grid.mask[i]) continue;
        const value = grid.cells[i];
        if (Number.isFinite(value)) pixels.data.set([...rainColor(value), 235], i * 4);
        else {
          const hatch = (i % grid.width + Math.floor(i / grid.width)) % 8 < 2;
          pixels.data.set(hatch ? [99, 122, 137, 175] : [224, 232, 236, 65], i * 4);
        }
      }
      context.putImageData(pixels, 0, 0);
      return { status: { ...status, state: "ready" as const, coverage: grid.coverage }, grid, url: canvas.toDataURL() };
    } catch {
      return { status: { ...status, state: "error" as const }, grid: null, url: "" };
    }
  }, [stations, boundary, method, now]);

  useEffect(() => { onStatus?.(result.status); }, [result, onStatus]);
  useEffect(() => {
    const grid = result.grid;
    if (!grid) return;
    const popup = L.popup();
    const onClick = (event: L.LeafletMouseEvent) => {
      const { west, east, north, south } = grid.bounds;
      const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
      const x = Math.floor((event.latlng.lng - west) / (east - west) * grid.width);
      const y = Math.floor((mercator(north) - mercator(event.latlng.lat)) / (mercator(north) - mercator(south)) * grid.height);
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height || !grid.mask[y * grid.width + x]) return;
      const value = grid.cells[y * grid.width + x], content = document.createElement("section");
      const heading = document.createElement("strong");
      heading.textContent = Number.isFinite(value) ? `ฝนประมาณ ${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })} มม./24 ชม.` : "พื้นที่นี้ไม่มีข้อมูลสถานีรองรับเพียงพอ";
      content.append(heading);
      const note = document.createElement("p"); note.textContent = `${method === "tps" ? "Thin-plate spline" : "IDW ระยะทางกำลังสอง"} · ค่าประมาณระหว่างสถานี`;
      content.append(note);
      const source = document.createElement("a"); source.href = "https://www.thaiwater.net/"; source.target = "_blank"; source.rel = "noopener noreferrer"; source.textContent = "แหล่งข้อมูลฝน · ThaiWater / สสน.";
      content.append(source);
      popup.setLatLng(event.latlng).setContent(content).openOn(map);
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); popup.remove(); };
  }, [result, method, map]);

  if (!result.grid || !result.url) return null;
  const { south, west, north, east } = result.grid.bounds;
  return <Pane name="rain-interpolation" style={{ zIndex: 370, pointerEvents: "none" }}>
    <ImageOverlay url={result.url} bounds={[[south, west], [north, east]]} opacity={opacity} interactive={false} className="rain-interpolation-surface" />
  </Pane>;
}
