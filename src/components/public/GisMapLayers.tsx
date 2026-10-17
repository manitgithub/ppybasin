"use client";

import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, Pane } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import { GIS_SOURCE_URL, gisLayers, landuseLegend, type GisLayerDefinition, type GisLayerStatus } from "@/lib/gis-layers";

const cache = new Map<string, FeatureCollection>();
export default function GisMapLayers({ selected, onStatus }: {
  selected: readonly string[]; onStatus?: (id: string, status: GisLayerStatus) => void;
}) {
  return <>
    <Pane name="gis-landuse" style={{ zIndex: 380 }} />
    <Pane name="gis-areas" style={{ zIndex: 390 }} />
    <Pane name="gis-lines" style={{ zIndex: 415 }} />
    <Pane name="gis-points" style={{ zIndex: 440 }} />
    {gisLayers.filter(def => selected.includes(def.id)).map(def => <GisLayer key={def.id} def={def} onStatus={onStatus} />)}
  </>;
}

function GisLayer({ def, onStatus }: { def: GisLayerDefinition; onStatus?: (id: string, status: GisLayerStatus) => void }) {
  const [data, setData] = useState<FeatureCollection | null>(() => cache.get(def.id) ?? null);
  const pane = def.point ? "gis-points" : def.id === "landuse" ? "gis-landuse" : def.id === "main_stream" ? "gis-lines" : "gis-areas";
  const renderer = useMemo(() => L.canvas({ pane, padding: .25 }), [pane]);
  useEffect(() => {
    const controller = new AbortController();
    if (cache.has(def.id)) { onStatus?.(def.id, "ready"); return; }
    onStatus?.(def.id, "loading");
    fetch(`/gis/${def.id}.geojson`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })
      .then(async response => {
        if (!response.ok) throw new Error("GIS unavailable");
        const result: FeatureCollection = await response.json();
        if (result.type !== "FeatureCollection" || !Array.isArray(result.features) || !result.features.length) throw new Error("Invalid GIS");
        if (controller.signal.aborted) return;
        cache.set(def.id, result); setData(result); onStatus?.(def.id, "ready");
      }).catch(() => { if (!controller.signal.aborted) onStatus?.(def.id, "error"); });
    return () => controller.abort();
  }, [def, onStatus]);
  if (!data) return null;
  return <GeoJSON data={data} pane={pane}
    style={feature => {
      if (def.point) return { renderer, color: "#fff", weight: 1.5, fillColor: def.color, fillOpacity: .95 };
      const land = def.id === "landuse";
      const color = land ? landuseLegend.find(item => item.code === String(feature?.properties?.LU_CODE ?? "").charAt(0))?.color ?? def.color : def.color;
      return { renderer, color, weight: land ? .4 : def.id === "main_stream" ? 4 : 1.5, fillColor: color, fillOpacity: land ? .28 : def.id === "waterways" ? .25 : .035, dashArray: def.id === "thanae_basin" ? "6 5" : undefined };
    }}
    pointToLayer={(_, latlng) => L.circleMarker(latlng, { renderer, pane: "gis-points", radius: def.id.includes("risk") ? 7 : 5, color: "#fff", weight: 1.5, fillColor: def.color, fillOpacity: .95 })}
    onEachFeature={(feature, layer) => {
      const properties = feature.properties ?? {};
      const title = String((def.titleKey && properties[def.titleKey]) || def.label);
      layer.bindTooltip(titleElement(title), { sticky: true });
      const popup = document.createElement("section");
      popup.style.cssText = "font-size:12px;line-height:1.6;max-width:280px;overflow-wrap:anywhere";
      const heading = document.createElement("strong"); heading.textContent = title; popup.append(heading);
      const category = document.createElement("p"); category.textContent = def.label; popup.append(category);
      for (const [label, key] of def.fields) {
        const value: unknown = properties[key];
        if (value === null || value === undefined || value === "") continue;
        const row = document.createElement("p");
        row.textContent = `${label}: ${typeof value === "number" ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : String(value)}`;
        popup.append(row);
      }
      const note = document.createElement("p");
      note.textContent = def.id.includes("risk") ? "ข้อมูลความเสี่ยงจากชุด GIS ไม่ใช่เหตุการณ์หรือประกาศเตือนปัจจุบัน · ไม่ระบุปีสำรวจ" : def.id === "landuse" ? "ข้อมูลการใช้ที่ดิน ปี 2563" : "ข้อมูลอ้างอิงจากชุด GIS ไม่ใช่ค่าตรวจวัดปัจจุบัน · ไม่ระบุปีสำรวจ";
      popup.append(note);
      const source = document.createElement("a"); source.href = GIS_SOURCE_URL; source.target = "_blank"; source.rel = "noopener noreferrer"; source.textContent = "แหล่งข้อมูล · Pa Phayom Water Watch"; popup.append(source);
      layer.bindPopup(popup);
    }} />;
}
function titleElement(title: string) { const span = document.createElement("span"); span.textContent = title; return span; }
