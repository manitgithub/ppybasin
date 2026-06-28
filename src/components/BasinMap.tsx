"use client";

import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, LayersControl, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import type { DashboardPayload, Shelter, TelemetryStation } from "@/lib/dashboard-data";

type BasinMapProps = {
  data: DashboardPayload;
};

const center: [number, number] = [7.7892, 100.2035];

function stationColor(status: TelemetryStation["status"]) {
  if (status === "critical") return "#e8334c";
  if (status === "watch") return "#f7b84b";
  return "#1976dc";
}

function shelterIcon(status: Shelter["status"]) {
  const color = status === "open" ? "#20bf82" : status === "full" ? "#e8334c" : "#f7b84b";

  return L.divIcon({
    className: "shelter-marker",
    html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 8px 20px rgba(15,23,42,.22)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function BoundsUpdater({ data }: BasinMapProps) {
  const map = useMap();

  useEffect(() => {
    const points = [
      ...data.stations.map((station) => [station.lat, station.lng] as [number, number]),
      ...data.shelters.map((shelter) => [shelter.lat, shelter.lng] as [number, number]),
    ];

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.24), { animate: false });
    }
  }, [data, map]);

  return null;
}

export default function BasinMap({ data }: BasinMapProps) {
  return (
    <MapContainer center={center} zoom={12} minZoom={10} scrollWheelZoom className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <LayersControl position="topright">
        <LayersControl.Overlay checked name="สถานีโทรมาตรน้ำ (Telemetries)">
          <>
            {data.stations.map((station) => (
              <CircleMarker
                key={station.id}
                center={[station.lat, station.lng]}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: stationColor(station.status),
                  fillOpacity: 0.95,
                  weight: 3,
                }}
                radius={8}
              >
                <Popup>
                  <strong>{station.name}</strong>
                  <br />
                  ระดับน้ำ {station.level.toFixed(2)} ม. ({station.id})
                </Popup>
              </CircleMarker>
            ))}
          </>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="ศูนย์พักพิงจากฐานข้อมูล">
          <>
            {data.shelters.map((shelter) => (
              <Marker key={shelter.id} position={[shelter.lat, shelter.lng]} icon={shelterIcon(shelter.status)}>
                <Popup>
                  <strong>{shelter.name}</strong>
                  <br />
                  รองรับ {shelter.capacity.toLocaleString("th-TH")} คน
                </Popup>
              </Marker>
            ))}
          </>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="ขอบเขตพื้นที่ถูกท่วม RID (WMS Geoservice)">
          <Polygon
            positions={data.floodArea}
            pathOptions={{
              color: "#ff4d5d",
              dashArray: "8 7",
              fillColor: "#ff4d5d",
              fillOpacity: 0.2,
              weight: 2,
            }}
          />
        </LayersControl.Overlay>
      </LayersControl>

      <BoundsUpdater data={data} />
    </MapContainer>
  );
}
