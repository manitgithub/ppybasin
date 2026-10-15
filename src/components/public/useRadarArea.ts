"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { analyzeRadarPixels, basinPixelSamples, RADAR_ANALYSIS_SIZE, RADAR_ANALYSIS_ZOOM, type BasinTile, type RadarAreaResult } from "@/lib/radar-area";
import type { RadarFrame, RainViewerData } from "@/lib/rainviewer";

let basinPromise: Promise<BasinTile[]> | null = null;
const masks = new Map<string, Uint8ClampedArray>();
const results = new Map<string, RadarAreaResult>();

function loadBasin() {
  if (!basinPromise) basinPromise = fetch("/boundaries/pa-phayom-basin.geojson", { signal: AbortSignal.timeout(10_000) })
    .then(async (response) => {
      if (!response.ok) throw new Error("Boundary unavailable");
      return basinPixelSamples(await response.json() as FeatureCollection<Polygon | MultiPolygon>);
    }).catch((error) => { basinPromise = null; throw error; });
  return basinPromise;
}

async function imagePixels(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Radar image unavailable");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    if (bitmap.width !== RADAR_ANALYSIS_SIZE || bitmap.height !== RADAR_ANALYSIS_SIZE) throw new Error("Unexpected image dimensions");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = RADAR_ANALYSIS_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Image analysis unavailable");
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally { bitmap.close(); }
}

export default function useRadarArea(enabled: boolean, data: RainViewerData | null, frame: RadarFrame | undefined, playing: boolean, revision = 0) {
  const [analysis, setAnalysis] = useState<{ path: string; result: RadarAreaResult | null; failed: boolean } | null>(null);
  const host = data?.host;
  const path = frame?.path;
  useEffect(() => {
    if (!enabled || !host || !path || playing) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    async function calculate() {
      try {
        let result = results.get(path!);
        if (!result) {
          const tiles = await loadBasin();
          const images = await Promise.all(tiles.map(async (tile) => {
            const suffix = `${RADAR_ANALYSIS_SIZE}/${RADAR_ANALYSIS_ZOOM}/${tile.x}/${tile.y}`;
            const maskKey = `${host}/${tile.x}/${tile.y}`;
            const [radar, coverage] = await Promise.all([
              imagePixels(`${host}${path}/${suffix}/2/0_0.png`, signal),
              masks.has(maskKey) ? Promise.resolve(masks.get(maskKey)!) : imagePixels(`${host}/v2/coverage/0/${suffix}/0/0_0.png`, signal),
            ]);
            masks.set(maskKey, coverage);
            return { samples: tile.samples, radar, coverage };
          }));
          result = analyzeRadarPixels(images);
          if (results.size >= 26) results.delete(results.keys().next().value!);
          results.set(path!, result);
        }
        if (!controller.signal.aborted) setAnalysis({ path: path!, result, failed: false });
      } catch {
        if (!controller.signal.aborted) setAnalysis({ path: path!, result: null, failed: true });
      }
    }
    void calculate();
    return () => controller.abort();
  }, [enabled, host, path, playing, revision]);
  return { result: !playing && analysis && analysis.path === path ? analysis.result : null, failed: Boolean(!playing && analysis && analysis.path === path && analysis.failed), playing };
}
