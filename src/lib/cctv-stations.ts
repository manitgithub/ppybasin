export type CctvStation = {
  code: string; name: string; location: string; waterway: string;
  lat: number; lng: number; cameras: readonly string[]; sourceUrl: string;
  provider: "ddpm" | "rid"; providerLabel: string; ridStationId?: number;
};

// DDPM verified 2026-10-15. RID verified from public station/CCTV feeds 2026-10-17.
// RID coordinates checked against public/boundaries/pa-phayom-basin.geojson.
export const cctvStations: readonly CctvStation[] = [
  {
    code: "PLG01", name: "ปตร.ท่าแนะ", location: "ต.เขาย่า อ.ศรีบรรพต จ.พัทลุง", waterway: "คลองท่าแนะ",
    lat: 7.729104, lng: 99.91402, cameras: ["PLG01-01", "PLG01-02"],
    sourceUrl: "https://cctv.disaster.go.th/stations/PLG01",
    provider: "ddpm", providerLabel: "ปภ.",
  },
  {
    code: "PLG02", name: "สะพานท่าสำเภา", location: "ต.พนางตุง อ.ควนขนุน จ.พัทลุง", waterway: "คลองปากประ",
    lat: 7.729762, lng: 100.1079, cameras: ["PLG02-01", "PLG02-02"],
    sourceUrl: "https://cctv.disaster.go.th/stations/PLG02",
    provider: "ddpm", providerLabel: "ปภ.",
  },
  {
    code: "TSL11", name: "ฝายคลองบ้านพร้าว", location: "ต.ป่าพะยอม อ.ป่าพะยอม จ.พัทลุง", waterway: "ลุ่มน้ำป่าพะยอม–ทะเลน้อย",
    lat: 7.83329, lng: 99.9109, cameras: ["TSL11-01"],
    sourceUrl: "https://telerid.rid.go.th/#/", provider: "rid", providerLabel: "กรมชลประทาน", ridStationId: 719,
  },
  {
    code: "TX83", name: "บ้านทะเลน้อย", location: "ต.ทะเลน้อย อ.ควนขนุน จ.พัทลุง", waterway: "ลุ่มน้ำป่าพะยอม–ทะเลน้อย",
    lat: 7.788817, lng: 100.12426, cameras: ["TX83-01"],
    sourceUrl: "https://telerid.rid.go.th/#/", provider: "rid", providerLabel: "กรมชลประทาน", ridStationId: 757,
  },
];

export function publicCctvCamera(camera: string) {
  const station = cctvStations.find((station) => station.cameras.includes(camera));
  if (!station) return null;
  const imageUrl = station.provider === "rid"
    ? `https://telerid.rid.go.th/restapi/main/camera/1/SKA-${station.code}/image.jpg`
    : `https://cctv.disaster.go.th/api/webrtc/public-frame.jpeg?src=${encodeURIComponent(camera)}`;
  return { station, imageUrl };
}

export function isPublicCctvCamera(camera: string) { return publicCctvCamera(camera) !== null; }
