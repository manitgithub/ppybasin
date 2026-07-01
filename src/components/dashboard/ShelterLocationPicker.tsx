"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

type ShelterLocationPickerProps = {
  lat: string;
  lng: string;
  onChange: (position: { lat: number; lng: number }) => void;
  helperText?: string;
  markerLabel?: string;
};

const defaultCenter: [number, number] = [7.7892, 100.2035];
const paPhayomBounds: [[number, number], [number, number]] = [
  [7.71, 100.12],
  [7.86, 100.29],
];

function mapPin(label: string) {
  return L.divIcon({
    className: "location-picker-pin",
    html: `<span style="display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:#216ed7;border:3px solid white;box-shadow:0 10px 24px rgba(15,23,42,.32);color:white;font-size:17px;font-weight:900">${label}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function parsePosition(lat: string, lng: string): [number, number] {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
    return [parsedLat, parsedLng];
  }

  return defaultCenter;
}

function MapClickHandler({ onChange }: { onChange: ShelterLocationPickerProps["onChange"] }) {
  useMapEvents({
    click(event) {
      onChange({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function PositionUpdater({ position }: { position: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    map.panTo(position, { animate: true });
  }, [map, position]);

  return null;
}

export default function ShelterLocationPicker({
  lat,
  lng,
  onChange,
  helperText = "คลิกบนแผนที่หรือเลื่อนหมุดเพื่อกำหนดพิกัดศูนย์อพยพ",
  markerLabel = "⌂",
}: ShelterLocationPickerProps) {
  const position = parsePosition(lat, lng);
  const pin = mapPin(markerLabel);

  return (
    <div className="overflow-hidden rounded-[8px] border border-slate-200">
      <div className="h-[280px]">
        <MapContainer
          center={position}
          zoom={14}
          minZoom={12}
          maxZoom={18}
          maxBounds={paPhayomBounds}
          maxBoundsViscosity={0.9}
          scrollWheelZoom
          className="z-0"
        >
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <Marker
            draggable
            icon={pin}
            position={position}
            eventHandlers={{
              dragend(event) {
                const marker = event.target as L.Marker;
                const next = marker.getLatLng();
                onChange({
                  lat: Number(next.lat.toFixed(6)),
                  lng: Number(next.lng.toFixed(6)),
                });
              },
            }}
          />
          <MapClickHandler onChange={onChange} />
          <PositionUpdater position={position} />
        </MapContainer>
      </div>
      <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>{helperText}</span>
        <span className="text-slate-700">
          {position[0].toFixed(6)}, {position[1].toFixed(6)}
        </span>
      </div>
    </div>
  );
}
