"use client";

import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import type { DashboardPayload, Shelter, TelemetryStation } from "@/lib/dashboard-data";

type BasinMapProps = {
  data: DashboardPayload;
};

const center: [number, number] = [7.7892, 100.2035];
const paPhayomBounds: [[number, number], [number, number]] = [
  [7.71, 100.12],
  [7.86, 100.29],
];

function isInPaPhayom(lat: number, lng: number) {
  return (
    lat >= paPhayomBounds[0][0] &&
    lat <= paPhayomBounds[1][0] &&
    lng >= paPhayomBounds[0][1] &&
    lng <= paPhayomBounds[1][1]
  );
}

function stationColor(status: TelemetryStation["status"]) {
  if (status === "critical") return "#e8334c";
  if (status === "watch") return "#f7b84b";
  return "#1976dc";
}

function shelterIcon(status: Shelter["status"]) {
  const color = status === "open" ? "#20bf82" : status === "full" ? "#e8334c" : "#f7b84b";

  return L.divIcon({
    className: "shelter-marker",
    html: `<span style="display:grid;place-items:center;width:27px;height:27px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 8px 20px rgba(15,23,42,.32);color:white;font-size:15px;font-weight:900">⌂</span>`,
    iconSize: [27, 27],
    iconAnchor: [13, 13],
  });
}

function BoundsUpdater() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(paPhayomBounds, { animate: false, padding: [12, 12] });
  }, [map]);

  return null;
}

export default function BasinMap({ data }: BasinMapProps) {
  const stations = data.stations.filter((station) => isInPaPhayom(station.lat, station.lng));
  const shelters = data.shelters.filter((shelter) => isInPaPhayom(shelter.lat, shelter.lng));

  return (
    <MapContainer
      center={center}
      zoom={13}
      minZoom={12}
      maxZoom={16}
      maxBounds={paPhayomBounds}
      maxBoundsViscosity={0.95}
      scrollWheelZoom
      className="z-0"
    >
      <TileLayer
        attribution="Tiles &copy; Esri"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />

      <Polygon
        positions={data.floodArea}
        pathOptions={{
          color: "#ff4d35",
          fillColor: "#ff3d28",
          fillOpacity: 0.42,
          weight: 2,
        }}
      />

      {stations.map((station) => (
        <CircleMarker
          key={station.id}
          center={[station.lat, station.lng]}
          pathOptions={{
            color: "#ffffff",
            fillColor: stationColor(station.status),
            fillOpacity: 0.98,
            weight: 3,
          }}
          radius={10}
        >
          <Popup>
            <strong>{station.name}</strong>
            <br />
            ระดับน้ำ {station.level.toFixed(2)} ม. ({station.id})
          </Popup>
        </CircleMarker>
      ))}

      {shelters.map((shelter) => (
        <Marker key={shelter.id} position={[shelter.lat, shelter.lng]} icon={shelterIcon(shelter.status)}>
          <Popup>
            <strong>{shelter.name}</strong>
            <br />
            รองรับ {shelter.capacity.toLocaleString("th-TH")} คน
          </Popup>
        </Marker>
      ))}

      <BoundsUpdater />
    </MapContainer>
  );
}
