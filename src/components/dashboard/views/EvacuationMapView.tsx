"use client";

import L from "leaflet";
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Check,
  ChevronDown,
  Clock3,
  Hospital,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import type { AppUser } from "@/lib/auth";
import type { DashboardPayload, Shelter } from "@/lib/dashboard-data";

type Coordinate = [number, number];

type FloodAlert = {
  id: string;
  title: string;
  areaName: string;
  message: string;
  severity: "watch" | "warning" | "critical";
  status: "pending" | "approved" | "rejected" | "resolved";
  latitude: number;
  longitude: number;
  radiusM: number;
  blockedRoads: string[];
  createdByName: string;
  approvedByName: string | null;
  createdAt: string;
  approvedAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
};

type RouteResult = {
  coordinates: Coordinate[];
  distance: number;
  duration: number;
  avoidsFlood: boolean;
  detourApplied: boolean;
  safeAlternatives: number;
  alternativesChecked: number;
};

type EvacuationMapViewProps = {
  data: DashboardPayload;
  currentUser: AppUser;
};

const mapCenter: Coordinate = [7.7899, 100.2065];

const severityStyle = {
  watch: { label: "เฝ้าระวัง", badge: "bg-sky-100 text-sky-800", path: "#0284c7" },
  warning: { label: "เตือนภัย", badge: "bg-amber-100 text-amber-900", path: "#d97706" },
  critical: { label: "ฉุกเฉิน", badge: "bg-rose-100 text-rose-900", path: "#e11d48" },
};

function distanceKm(start: Coordinate, end: Coordinate) {
  const earthRadius = 6371;
  const lat = (end[0] - start[0]) * Math.PI / 180;
  const lng = (end[1] - start[1]) * Math.PI / 180;
  const a = Math.sin(lat / 2) ** 2 + Math.cos(start[0] * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180) * Math.sin(lng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shelterIcon(shelter: Shelter, selected: boolean) {
  const color = shelter.status === "open" ? "#059669" : shelter.status === "full" ? "#e11d48" : "#d97706";
  return L.divIcon({
    className: "evacuation-shelter-marker",
    html: `<span style="display:grid;place-items:center;width:${selected ? 38 : 32}px;height:${selected ? 38 : 32}px;border-radius:8px;background:${color};border:3px solid white;box-shadow:0 8px 24px rgba(15,23,42,.34);color:white;font-size:13px;font-weight:900">ศ</span>`,
    iconSize: selected ? [38, 38] : [32, 32],
    iconAnchor: selected ? [19, 19] : [16, 16],
  });
}

const userIcon = L.divIcon({
  className: "evacuation-user-marker",
  html: '<span style="display:block;width:22px;height:22px;border-radius:999px;background:#1479e7;border:5px solid white;box-shadow:0 0 0 7px rgba(20,121,231,.22),0 8px 20px rgba(15,23,42,.28)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapViewport({ route, userPosition, shelter }: { route: RouteResult | null; userPosition: Coordinate | null; shelter: Shelter | null }) {
  const map = useMap();

  useEffect(() => {
    if (route?.coordinates.length) {
      map.fitBounds(L.latLngBounds(route.coordinates), { animate: true, paddingTopLeft: [40, 80], paddingBottomRight: [420, 80] });
      return;
    }
    if (userPosition && shelter) {
      map.fitBounds(L.latLngBounds([userPosition, [shelter.lat, shelter.lng]]), { animate: true, padding: [70, 70] });
      return;
    }
    if (userPosition) map.flyTo(userPosition, 14, { duration: 0.7 });
  }, [map, route, shelter, userPosition]);

  return null;
}

function AlertLocationPicker({ enabled, onPick }: { enabled: boolean; onPick: (position: Coordinate) => void }) {
  useMapEvents({
    click(event) {
      if (enabled) onPick([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function alertBoundary(alert: FloodAlert): Coordinate[] {
  const latitudeRadius = alert.radiusM / 111_320;
  const longitudeRadius = alert.radiusM / (111_320 * Math.cos(alert.latitude * Math.PI / 180));
  return Array.from({ length: 20 }, (_, index) => {
    const angle = index / 20 * Math.PI * 2;
    return [alert.latitude + Math.sin(angle) * latitudeRadius, alert.longitude + Math.cos(angle) * longitudeRadius];
  });
}

export default function EvacuationMapView({ data, currentUser }: EvacuationMapViewProps) {
  const [userPosition, setUserPosition] = useState<Coordinate | null>(null);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeState, setRouteState] = useState<"idle" | "locating" | "routing" | "error">("idle");
  const [routeMessage, setRouteMessage] = useState("ใช้ตำแหน่งปัจจุบันหรือปักหมุดบนแผนที่เพื่อกำหนดต้นทาง");
  const [panel, setPanel] = useState<"route" | "alerts">("route");
  const [panelOpen, setPanelOpen] = useState(true);
  const [alerts, setAlerts] = useState<FloodAlert[]>([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [databaseConfigured, setDatabaseConfigured] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(
    () => typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const [originSource, setOriginSource] = useState<"gps" | "pin" | null>(null);
  const [placingStart, setPlacingStart] = useState(false);
  const [placingAlert, setPlacingAlert] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);
  const [confirmResolveId, setConfirmResolveId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "แจ้งเตือนน้ำท่วมในพื้นที่",
    areaName: "อำเภอป่าพะยอม",
    message: "โปรดติดตามสถานการณ์และเตรียมอพยพตามคำแนะนำของเจ้าหน้าที่",
    severity: "warning" as FloodAlert["severity"],
    latitude: mapCenter[0],
    longitude: mapCenter[1],
    radiusM: 1500,
    blockedRoads: "",
  });

  const canManageAlerts = currentUser.role === "admin" || currentUser.permissions.includes("alerts:manage");
  const canApproveAlerts = currentUser.role === "admin";
  const shelters = useMemo(
    () => data.shelters.filter((shelter) => Number.isFinite(shelter.lat) && Number.isFinite(shelter.lng)),
    [data.shelters],
  );
  const availableShelters = useMemo(() => shelters.filter((shelter) => shelter.status === "open"), [shelters]);
  const selectedShelter = shelters.find((shelter) => shelter.id === selectedShelterId) ?? null;
  const approvedAlerts = useMemo(() => alerts.filter((alert) => alert.status === "approved"), [alerts]);
  const pendingAlerts = useMemo(() => alerts.filter((alert) => alert.status === "pending"), [alerts]);
  const nearbyAlerts = useMemo(() => {
    if (!userPosition) return approvedAlerts;
    return approvedAlerts.filter((alert) => distanceKm(userPosition, [alert.latitude, alert.longitude]) * 1000 <= alert.radiusM);
  }, [approvedAlerts, userPosition]);
  const activeAlert = nearbyAlerts[0] ?? approvedAlerts[0] ?? null;

  const setRouteOrigin = useCallback((position: Coordinate, source: "gps" | "pin") => {
    setUserPosition(position);
    setOriginSource(source);
    setRoute(null);
    const nearest = [...availableShelters].sort(
      (a, b) => distanceKm(position, [a.lat, a.lng]) - distanceKm(position, [b.lat, b.lng]),
    )[0];
    if (nearest) setSelectedShelterId(nearest.id);
    setRouteState("idle");
    setRouteMessage(
      nearest
        ? `ตั้งต้นทางจาก${source === "gps" ? "ตำแหน่งปัจจุบัน" : "หมุดบนแผนที่"} และเลือก ${nearest.name} ซึ่งอยู่ใกล้ที่สุด`
        : "ตั้งจุดเริ่มต้นแล้ว แต่ไม่พบศูนย์พักพิงที่เปิดใช้งาน",
    );
  }, [availableShelters]);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await fetch("/api/flood-alerts", { cache: "no-store" });
      const payload = await response.json() as { alerts?: FloodAlert[]; databaseConfigured?: boolean };
      if (response.ok) {
        setAlerts(payload.alerts ?? []);
        setDatabaseConfigured(payload.databaseConfigured !== false);
      }
    } catch {
      setAlertMessage("ยังเชื่อมต่อข้อมูลประกาศไม่ได้");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/flood-alerts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as { alerts?: FloodAlert[]; databaseConfigured?: boolean } }))
      .then(({ response, payload }) => {
        if (!response.ok) return;
        setAlerts(payload.alerts ?? []);
        setDatabaseConfigured(payload.databaseConfigured !== false);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [loadAlerts]);

  useEffect(() => {
    const nearbyAlert = nearbyAlerts[0];
    if (!notificationEnabled || !userPosition || !nearbyAlert || typeof Notification === "undefined") return;
    const key = `ppybasin-alert-${nearbyAlert.id}`;
    if (window.localStorage.getItem(key)) return;
    new Notification(nearbyAlert.title, { body: `${nearbyAlert.areaName}: ${nearbyAlert.message}`, tag: key });
    window.localStorage.setItem(key, "shown");
  }, [nearbyAlerts, notificationEnabled, userPosition]);

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setRouteState("error");
      setRouteMessage("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setRouteState("locating");
    setRouteMessage("กำลังค้นหาตำแหน่งของคุณ...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: Coordinate = [coords.latitude, coords.longitude];
        setRouteOrigin(position, "gps");
        setForm((current) => ({ ...current, latitude: position[0], longitude: position[1] }));
      },
      () => {
        setRouteState("error");
        setRouteMessage("ไม่สามารถเข้าถึงตำแหน่ง กรุณาอนุญาตตำแหน่งในเบราว์เซอร์");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, [setRouteOrigin]);

  const calculateRoute = useCallback(async () => {
    if (!userPosition) {
      setRouteState("error");
      setRouteMessage("กรุณาใช้ตำแหน่งปัจจุบันหรือปักหมุดจุดเริ่มต้นบนแผนที่");
      return;
    }
    if (!selectedShelter) {
      setRouteState("error");
      setRouteMessage("กรุณาเลือกจุดพักพิงปลายทาง");
      return;
    }
    setRouteState("routing");
    setRouteMessage("กำลังตรวจสอบเส้นทางและพื้นที่น้ำท่วม...");
    setRoute(null);
    try {
      const response = await fetch("/api/evacuation-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: userPosition,
          destination: [selectedShelter.lat, selectedShelter.lng],
          floodAreas: [data.floodArea, ...approvedAlerts.map(alertBoundary)],
        }),
      });
      const payload = await response.json() as {
        route?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } };
        avoidsFlood?: boolean;
        detourApplied?: boolean;
        safeAlternatives?: number;
        alternativesChecked?: number;
      };
      if (!response.ok || !payload.route) throw new Error("route unavailable");
      if (!payload.avoidsFlood) {
        setRoute(null);
        setRouteState("error");
        setRouteMessage("ยังไม่พบทางถนนที่เลี่ยงพื้นที่น้ำท่วมได้ทั้งหมด ระบบจึงไม่แนะนำเส้นทางนี้ โปรดรอคำแนะนำเจ้าหน้าที่");
        return;
      }
      setRoute({
        coordinates: payload.route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distance: payload.route.distance,
        duration: payload.route.duration,
        avoidsFlood: Boolean(payload.avoidsFlood),
        detourApplied: Boolean(payload.detourApplied),
        safeAlternatives: payload.safeAlternatives ?? 0,
        alternativesChecked: payload.alternativesChecked ?? 1,
      });
      setRouteState("idle");
      setRouteMessage(payload.detourApplied ? "แนะนำเส้นทางปลอดภัยที่ถึงเร็วที่สุด โดยไม่ผ่านพื้นที่น้ำท่วม" : "นี่คือเส้นทางปลอดภัยที่ถึงเร็วที่สุด");
    } catch {
      setRouteState("error");
      setRouteMessage("บริการคำนวณเส้นทางไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง");
    }
  }, [approvedAlerts, data.floodArea, selectedShelter, userPosition]);

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      setAlertMessage("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationEnabled(permission === "granted");
    setAlertMessage(permission === "granted" ? "เปิดแจ้งเตือนสำหรับบริเวณนี้แล้ว" : "ยังไม่ได้รับอนุญาตให้แจ้งเตือน");
    if (permission === "granted" && !userPosition) locateUser();
  };

  const submitAlert = async () => {
    setSavingAlert(true);
    setAlertMessage("");
    try {
      const response = await fetch("/api/flood-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          blockedRoads: form.blockedRoads.split(",").map((road) => road.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "บันทึกไม่สำเร็จ");
      setAlertMessage("ส่งประกาศเข้าคิวอนุมัติแล้ว ประชาชนจะยังไม่เห็นจนกว่าผู้ดูแลระบบจะอนุมัติ");
      await loadAlerts();
    } catch (error) {
      setAlertMessage(error instanceof Error ? error.message : "บันทึกประกาศไม่สำเร็จ");
    } finally {
      setSavingAlert(false);
    }
  };

  const reviewAlert = async (id: string, action: "approve" | "reject" | "resolve") => {
    const response = await fetch("/api/flood-alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setAlertMessage(
      response.ok
        ? action === "approve"
          ? "อนุมัติและเผยแพร่ประกาศแล้ว"
          : action === "resolve"
            ? "ยุติประกาศแล้ว พื้นที่นี้ถูกนำออกจากการแจ้งเตือนและการเลี่ยงเส้นทาง"
            : "ไม่อนุมัติประกาศแล้ว"
        : "อัปเดตประกาศไม่สำเร็จ",
    );
    if (response.ok) {
      setConfirmResolveId(null);
      await loadAlerts();
    }
  };

  return (
    <section className="relative h-[calc(100dvh-104px)] min-h-[620px] overflow-hidden rounded-[8px] border border-slate-200 bg-slate-100 shadow-sm">
      <MapContainer center={mapCenter} zoom={13} minZoom={9} maxZoom={18} zoomControl={false} scrollWheelZoom className={`z-0 h-full w-full ${placingStart || placingAlert ? "cursor-crosshair" : ""}`}>
        <TileLayer attribution="Tiles &copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ZoomControl position="bottomright" />
        <MapViewport route={route} userPosition={userPosition} shelter={selectedShelter} />
        <AlertLocationPicker
          enabled={placingAlert}
          onPick={([latitude, longitude]) => {
            setForm((current) => ({ ...current, latitude, longitude }));
            setPlacingAlert(false);
          }}
        />
        <AlertLocationPicker
          enabled={placingStart}
          onPick={(position) => {
            setRouteOrigin(position, "pin");
            setPlacingStart(false);
          }}
        />

        {data.floodArea.length >= 3 && (
          <Polygon positions={data.floodArea} pathOptions={{ color: "#e11d48", fillColor: "#fb7185", fillOpacity: 0.28, weight: 3, dashArray: "8 6" }}>
            <Popup><strong>พื้นที่น้ำท่วม/เฝ้าระวัง</strong><br />ระบบจะพยายามหาเส้นทางที่ไม่ตัดพื้นที่นี้</Popup>
          </Polygon>
        )}

        {approvedAlerts.map((alert) => (
          <Circle
            key={alert.id}
            center={[alert.latitude, alert.longitude]}
            radius={alert.radiusM}
            pathOptions={{ color: severityStyle[alert.severity].path, fillOpacity: 0.12, weight: 2 }}
          >
            <Popup><strong>{alert.title}</strong><br />{alert.areaName}<br />{alert.message}</Popup>
          </Circle>
        ))}

        {shelters.map((shelter) => (
          <Marker
            key={shelter.id}
            position={[shelter.lat, shelter.lng]}
            icon={shelterIcon(shelter, shelter.id === selectedShelterId)}
            eventHandlers={{ click: () => { setSelectedShelterId(shelter.id); setRoute(null); } }}
          >
            <Popup><strong>{shelter.name}</strong><br />สถานะ {shelter.status} · รองรับ {shelter.capacity.toLocaleString("th-TH")} คน</Popup>
          </Marker>
        ))}

        {userPosition && (
          <Marker
            position={userPosition}
            icon={userIcon}
            draggable
            eventHandlers={{
              dragend(event) {
                const point = event.target.getLatLng();
                setRouteOrigin([point.lat, point.lng], "pin");
              },
            }}
          >
            <Popup>{originSource === "gps" ? "ตำแหน่งปัจจุบันของคุณ" : "จุดเริ่มต้นที่ปักหมุด"}<br />ลากหมุดเพื่อปรับจุดเริ่มต้นได้</Popup>
          </Marker>
        )}
        {placingAlert && <Circle center={[form.latitude, form.longitude]} radius={form.radiusM} pathOptions={{ color: "#e11d48", fillOpacity: 0.12 }} />}
        {route && (
          <Polyline
            positions={route.coordinates}
            pathOptions={{ color: route.avoidsFlood ? "#047857" : "#e11d48", weight: 7, opacity: 0.92, lineCap: "round", lineJoin: "round" }}
          />
        )}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex items-start justify-between gap-3 md:inset-x-4 md:top-4">
        <div className="pointer-events-auto max-w-[min(620px,calc(100%-64px))] overflow-hidden rounded-[8px] border border-slate-200 bg-white/96 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 px-3 py-2.5 md:px-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-[7px] bg-[#0b2944] text-white"><Route size={19} /></span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-extrabold text-slate-900 md:text-base">แผนที่และเส้นทางอพยพ</h2>
              <p className="truncate text-[11px] font-semibold text-slate-500 md:text-xs">เลือกหรือปักหมุดจุดเริ่มต้น แล้วตรวจเส้นทางเลี่ยงพื้นที่น้ำท่วม</p>
            </div>
          </div>
        </div>
        <button
          title={notificationEnabled ? "เปิดแจ้งเตือนแล้ว" : "เปิดแจ้งเตือนน้ำท่วมบริเวณนี้"}
          onClick={() => void enableNotifications()}
          className={`pointer-events-auto grid size-11 shrink-0 place-items-center rounded-[8px] border shadow-lg transition ${notificationEnabled ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          <BellRing size={20} />
        </button>
      </div>

      {activeAlert && (
        <div className="pointer-events-none absolute left-3 right-3 top-[76px] z-[500] md:left-4 md:right-auto md:top-[82px] md:w-[430px]">
          <div className="pointer-events-auto flex items-start gap-3 rounded-[8px] border border-rose-200 bg-rose-50/96 p-3 shadow-lg backdrop-blur-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-700" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-[6px] px-2 py-0.5 text-[10px] font-extrabold ${severityStyle[activeAlert.severity].badge}`}>{severityStyle[activeAlert.severity].label}</span>
                <span className="text-[10px] font-bold text-rose-700">อนุมัติแล้ว {formatDate(activeAlert.approvedAt)}</span>
              </div>
              <p className="mt-1 text-sm font-extrabold text-rose-950">{activeAlert.title} · {activeAlert.areaName}</p>
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-rose-800">{activeAlert.message}</p>
            </div>
          </div>
        </div>
      )}

      <aside className={`absolute bottom-3 left-3 right-3 z-[600] max-h-[62%] overflow-hidden rounded-[8px] border border-slate-200 bg-white/97 shadow-2xl backdrop-blur-md transition-transform md:bottom-auto md:left-auto md:right-4 md:top-[82px] md:w-[380px] md:max-h-[calc(100%-102px)] ${panelOpen ? "translate-y-0" : "translate-y-[calc(100%-48px)] md:translate-y-0 md:translate-x-[calc(100%-48px)]"}`}>
        <div className="flex h-12 items-center border-b border-slate-200 bg-slate-50/90">
          <button onClick={() => setPanel("route")} className={`flex h-full flex-1 items-center justify-center gap-2 text-xs font-extrabold ${panel === "route" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}><Navigation size={16} /> เส้นทาง</button>
          <button onClick={() => setPanel("alerts")} className={`relative flex h-full flex-1 items-center justify-center gap-2 text-xs font-extrabold ${panel === "alerts" ? "border-b-2 border-rose-600 text-rose-700" : "text-slate-500"}`}>
            <BellRing size={16} /> แจ้งเตือน
            {pendingAlerts.length > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{pendingAlerts.length}</span>}
          </button>
          <button title={panelOpen ? "ย่อแผง" : "เปิดแผง"} onClick={() => setPanelOpen((open) => !open)} className="grid size-12 place-items-center border-l border-slate-200 text-slate-500 hover:bg-white"><ChevronDown size={18} className={panelOpen ? "" : "rotate-180"} /></button>
        </div>

        <div className="max-h-[calc(62vh-48px)] overflow-y-auto md:max-h-[calc(100vh-254px)]">
          {panel === "route" ? (
            <div className="space-y-4 p-4">
              <div>
                <span className="mb-1.5 block text-xs font-extrabold text-slate-600">จุดเริ่มต้น</span>
                <div className="grid grid-cols-2 gap-2">
                  <button title="ใช้ GPS ของอุปกรณ์" onClick={() => { setPlacingStart(false); setPlacingAlert(false); locateUser(); }} disabled={routeState === "locating"} className={`flex h-11 items-center justify-center gap-2 rounded-[8px] px-3 text-xs font-extrabold transition disabled:opacity-60 ${originSource === "gps" ? "bg-[#126fd1] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                    <LocateFixed size={17} /> {routeState === "locating" ? "กำลังค้นหา..." : "ตำแหน่งปัจจุบัน"}
                  </button>
                  <button title="คลิกบนแผนที่เพื่อกำหนดจุดเริ่มต้น" onClick={() => { setPlacingStart((placing) => !placing); setPlacingAlert(false); setRoute(null); setRouteMessage("คลิกบนแผนที่เพื่อปักหมุดจุดเริ่มต้น"); }} className={`flex h-11 items-center justify-center gap-2 rounded-[8px] px-3 text-xs font-extrabold transition ${placingStart ? "bg-amber-500 text-amber-950" : originSource === "pin" ? "bg-[#0b2944] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                    <MapPin size={17} /> {placingStart ? "คลิกบนแผนที่" : "ปักหมุดต้นทาง"}
                  </button>
                </div>
                {userPosition && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <MapPin size={13} /> {originSource === "gps" ? "พิกัดจากอุปกรณ์" : "พิกัดที่ปักหมุด"}: {userPosition[0].toFixed(5)}, {userPosition[1].toFixed(5)}
                  </p>
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold text-slate-600">จุดพักพิงปลายทาง</span>
                <select value={selectedShelterId ?? ""} onChange={(event) => { setSelectedShelterId(event.target.value); setRoute(null); }} className="h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500">
                  <option value="">เลือกจุดพักพิง</option>
                  {shelters.map((shelter) => <option key={shelter.id} value={shelter.id} disabled={shelter.status !== "open"}>{shelter.name} ({shelter.status === "open" ? "เปิด" : "ไม่พร้อม"})</option>)}
                </select>
              </label>

              {selectedShelter && (
                <div className="flex items-start gap-3 border-y border-slate-100 py-3">
                  <Hospital className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                  <div><p className="text-sm font-extrabold text-slate-800">{selectedShelter.name}</p><p className="text-xs font-semibold text-slate-500">รองรับ {selectedShelter.capacity.toLocaleString("th-TH")} คน{userPosition ? ` · ห่างทางตรง ${distanceKm(userPosition, [selectedShelter.lat, selectedShelter.lng]).toFixed(1)} กม.` : ""}</p></div>
                </div>
              )}

              <button onClick={() => void calculateRoute()} disabled={routeState === "routing" || !selectedShelter} className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-700 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                <Route size={18} /> {routeState === "routing" ? "กำลังหาเส้นทางที่เร็วที่สุด..." : "หาเส้นทางปลอดภัยที่เร็วที่สุด"}
              </button>

              <div className={`rounded-[8px] p-3 text-xs font-bold ${routeState === "error" || (route && !route.avoidsFlood) ? "bg-rose-50 text-rose-800" : route ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600"}`}>
                <p className="flex items-start gap-2">{route?.avoidsFlood ? <ShieldCheck size={17} className="shrink-0" /> : <AlertTriangle size={17} className="shrink-0" />}{routeMessage}</p>
                {route && <div className="mt-3 grid grid-cols-3 gap-2 border-t border-current/10 pt-3 text-center"><span><strong className="block text-base">{Math.ceil(route.duration / 60)}</strong>นาที</span><span><strong className="block text-base">{(route.distance / 1000).toFixed(1)}</strong>กม.</span><span><strong className="block text-base">{route.safeAlternatives}/{route.alternativesChecked}</strong>เส้นปลอดภัย</span></div>}
              </div>

              <p className="text-[11px] font-semibold leading-relaxed text-slate-500">เส้นทางจาก OpenStreetMap/OSRM และพื้นที่เสี่ยงในระบบ ควรปฏิบัติตามคำสั่งเจ้าหน้าที่และสภาพถนนจริงเสมอ</p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <button onClick={() => void enableNotifications()} className={`flex h-11 w-full items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-extrabold ${notificationEnabled ? "bg-emerald-100 text-emerald-800" : "bg-rose-600 text-white hover:bg-rose-700"}`}><BellRing size={18} /> {notificationEnabled ? "เปิดแจ้งเตือนบริเวณนี้แล้ว" : "แจ้งเตือนน้ำท่วมบริเวณนี้"}</button>
              {alertMessage && <p className="rounded-[8px] bg-slate-100 p-3 text-xs font-bold text-slate-700">{alertMessage}</p>}

              <div>
                <h3 className="text-sm font-extrabold text-slate-800">ประกาศที่เผยแพร่</h3>
                <div className="mt-2 space-y-2">
                  {approvedAlerts.length ? approvedAlerts.map((alert) => (
                    <article key={alert.id} className="border-b border-slate-100 py-2 last:border-0">
                      <div className="flex items-center gap-2"><span className={`rounded-[6px] px-2 py-0.5 text-[10px] font-extrabold ${severityStyle[alert.severity].badge}`}>{severityStyle[alert.severity].label}</span><span className="text-[10px] font-bold text-slate-400">{formatDate(alert.approvedAt)}</span></div>
                      <p className="mt-1 text-xs font-extrabold text-slate-800">{alert.title} · {alert.areaName}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">{alert.message}</p>
                      {canApproveAlerts && (
                        confirmResolveId === alert.id ? (
                          <div className="mt-3 flex items-center gap-2 rounded-[7px] bg-slate-100 p-2">
                            <p className="min-w-0 flex-1 text-[10px] font-bold text-slate-700">ยืนยันว่าพื้นที่กลับมาสัญจรได้แล้ว?</p>
                            <button onClick={() => void reviewAlert(alert.id, "resolve")} className="h-8 rounded-[6px] bg-emerald-700 px-2.5 text-[10px] font-extrabold text-white">ยืนยันยุติ</button>
                            <button title="ยกเลิก" onClick={() => setConfirmResolveId(null)} className="grid size-8 place-items-center rounded-[6px] bg-white text-slate-500"><X size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmResolveId(alert.id)} className="mt-3 flex h-8 items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 hover:text-emerald-900"><BellOff size={14} /> ยุติการแจ้งเตือน</button>
                        )
                      )}
                    </article>
                  )) : <p className="rounded-[8px] bg-emerald-50 p-3 text-xs font-bold text-emerald-800">ยังไม่มีประกาศน้ำท่วมที่ผ่านการอนุมัติ</p>}
                </div>
              </div>

              {canManageAlerts && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-slate-800">สร้างประกาศ</h3><p className="text-[10px] font-bold text-amber-700">ต้องผ่านผู้ดูแลระบบก่อนเผยแพร่</p></div><Clock3 size={18} className="text-amber-600" /></div>
                  {!databaseConfigured && <p className="mb-3 rounded-[8px] bg-amber-50 p-3 text-xs font-bold text-amber-900">ต้องตั้งค่า DATABASE_URL และรัน migration 007 ก่อนบันทึกประกาศ</p>}
                  <div className="space-y-2">
                    <input aria-label="หัวข้อประกาศ" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="h-10 w-full rounded-[8px] border border-slate-300 px-3 text-xs font-bold" placeholder="หัวข้อประกาศ" />
                    <input aria-label="ชื่อพื้นที่" value={form.areaName} onChange={(event) => setForm({ ...form, areaName: event.target.value })} className="h-10 w-full rounded-[8px] border border-slate-300 px-3 text-xs font-bold" placeholder="ชื่อพื้นที่" />
                    <textarea aria-label="รายละเอียดประกาศ" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="min-h-20 w-full resize-y rounded-[8px] border border-slate-300 p-3 text-xs font-bold" placeholder="คำแนะนำสำหรับประชาชน" />
                    <div className="grid grid-cols-2 gap-2"><select aria-label="ระดับประกาศ" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as FloodAlert["severity"] })} className="h-10 rounded-[8px] border border-slate-300 px-2 text-xs font-bold"><option value="watch">เฝ้าระวัง</option><option value="warning">เตือนภัย</option><option value="critical">ฉุกเฉิน</option></select><input aria-label="รัศมีแจ้งเตือน" type="number" min={100} max={50000} value={form.radiusM} onChange={(event) => setForm({ ...form, radiusM: Number(event.target.value) })} className="h-10 rounded-[8px] border border-slate-300 px-3 text-xs font-bold" /></div>
                    <input aria-label="ถนนที่ปิด" value={form.blockedRoads} onChange={(event) => setForm({ ...form, blockedRoads: event.target.value })} className="h-10 w-full rounded-[8px] border border-slate-300 px-3 text-xs font-bold" placeholder="ถนนที่ควรเลี่ยง คั่นด้วยจุลภาค" />
                    <button onClick={() => { setPlacingAlert((placing) => !placing); setPlacingStart(false); }} className={`flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border text-xs font-extrabold ${placingAlert ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-300 text-slate-700"}`}><MapPin size={15} /> {placingAlert ? "คลิกตำแหน่งบนแผนที่" : "เลือกบริเวณแจ้งเตือนบนแผนที่"}</button>
                    <button disabled={savingAlert || !databaseConfigured} onClick={() => void submitAlert()} className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0b2944] text-xs font-extrabold text-white disabled:opacity-50"><Send size={15} /> {savingAlert ? "กำลังส่ง..." : "ส่งให้ผู้ดูแลอนุมัติ"}</button>
                  </div>
                </div>
              )}

              {canApproveAlerts && pendingAlerts.length > 0 && (
                <div className="border-t border-slate-200 pt-4"><h3 className="text-sm font-extrabold text-slate-800">รอการอนุมัติ ({pendingAlerts.length})</h3><div className="mt-2 space-y-3">{pendingAlerts.map((alert) => <article key={alert.id} className="rounded-[8px] border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-extrabold text-amber-950">{alert.title} · {alert.areaName}</p><p className="mt-1 text-[11px] font-semibold text-amber-800">โดย {alert.createdByName} · {formatDate(alert.createdAt)}</p><div className="mt-3 flex gap-2"><button onClick={() => void reviewAlert(alert.id, "approve")} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[7px] bg-emerald-700 text-xs font-extrabold text-white"><Check size={14} /> อนุมัติ</button><button onClick={() => void reviewAlert(alert.id, "reject")} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[7px] border border-rose-300 bg-white text-xs font-extrabold text-rose-700"><X size={14} /> ไม่อนุมัติ</button></div></article>)}</div></div>
              )}
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
