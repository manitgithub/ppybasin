"use client";

import { useCallback, useEffect, useState } from "react";
import useRadarArea from "./useRadarArea";
import { radarTileUrl, type RainViewerData, type RadarOverlay } from "@/lib/rainviewer";

export default function useRainViewer(enabled: boolean) {
  const [data, setData] = useState<RainViewerData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [tileErrorPath, setTileErrorPath] = useState("");
  const onTileError = useCallback((path: string) => setTileErrorPath(path), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/rainviewer", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        if (!response.ok) throw new Error("Radar unavailable");
        const payload: RainViewerData = await response.json();
        if (!Array.isArray(payload.frames) || !payload.frames.length) throw new Error("No radar frames");
        if (!controller.signal.aborted) { setData(payload); setError(false); }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally { pending = false; }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 300_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [enabled, retry]);

  useEffect(() => {
    if (!enabled || !playing || !data || error) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSelectedTime((time) => {
        const index = time === null ? data.frames.length - 1 : data.frames.findIndex((frame) => frame.time === time);
        return data.frames[(index + 1) % data.frames.length].time;
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [enabled, playing, data, error]);

  const frames = data?.frames ?? [];
  const index = selectedTime === null ? frames.length - 1 : frames.findIndex((frame) => frame.time === selectedTime);
  const frame = frames[index < 0 ? frames.length - 1 : index];
  const overlay: RadarOverlay | null = enabled && data && frame ? { key: `${frame.path}:${retry}`, url: radarTileUrl(data, frame), path: frame.path, opacity } : null;
  const area = useRadarArea(enabled, data, frame, playing && !error, retry);
  return {
    area, data, error, playing: playing && !error, setPlaying, opacity, setOpacity, frame,
    index: Math.max(0, index < 0 ? frames.length - 1 : index), overlay,
    selectFrame: (index: number) => { setPlaying(false); setSelectedTime(frames[index]?.time ?? null); },
    latest: () => { setPlaying(false); setSelectedTime(null); },
    retry: () => { setTileErrorPath(""); setError(false); setRetry((value) => value + 1); },
    tileError: Boolean(frame && tileErrorPath === frame.path), onTileError,
  };
}
