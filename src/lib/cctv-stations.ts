export type CctvStation = {
  code: string; name: string; location: string; waterway: string;
  lat: number; lng: number; cameras: readonly string[]; sourceUrl: string;
  provider: "ddpm" | "rid"; providerLabel: string; ridStationId?: number; ridCameraPath?: string;
};

// DDPM verified 2026-10-15. RID verified from public station/CCTV feeds 2026-10-17.
// Includes nearby RID stations outside the basin, requested for monitoring.
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
    sourceUrl: "https://telerid.rid.go.th/#/", provider: "rid", providerLabel: "กรมชลประทาน", ridStationId: 719, ridCameraPath: "/1/SKA-TSL11/image.jpg",
  },
  {
    code: "TX83", name: "บ้านทะเลน้อย", location: "ต.ทะเลน้อย อ.ควนขนุน จ.พัทลุง", waterway: "ลุ่มน้ำป่าพะยอม–ทะเลน้อย",
    lat: 7.788817, lng: 100.12426, cameras: ["TX83-01"],
    sourceUrl: "https://telerid.rid.go.th/#/", provider: "rid", providerLabel: "กรมชลประทาน", ridStationId: 757, ridCameraPath: "/1/SKA-TX83/image.jpg",
  },
  {
    code: "TPN11", name: "ฝายไม้เสียบ", location: "ต.เกาะขันธ์ อ.ชะอวด จ.นครศรีธรรมราช", waterway: "ลุ่มน้ำปากพนัง",
    lat: 7.891563, lng: 99.908885, cameras: ["TPN11-01"],
    sourceUrl: "https://telerid.rid.go.th/#/", provider: "rid", providerLabel: "กรมชลประทาน", ridStationId: 682, ridCameraPath: "/1/SSE-U-TPN11/image.jpg",
  },
  {
    code: "TX276", name: "บ้านเขาปู่", location: "ต.เขาปู่ อ.ศรีบรรพต จ.พัทลุง", waterway: "ลุ่มน้ำทะเลสาบสงขลา",
    lat: 7.706969, lng: 99.842081, cameras: ["TX276-01"],
    sourceUrl: "https://telerid.rid.go.th/#/", provider: "rid", providerLabel: "กรมชลประทาน", ridStationId: 754, ridCameraPath: "/1/SKA-TX276/image.jpg",
  },
  {
    code: "TSL12", name: "ปตร.คลองท่าแนะ", location: "ต.เขาย่า อ.ศรีบรรพต จ.พัทลุง", waterway: "คลองท่าแนะ",
    lat: 7.72914, lng: 99.914, cameras: ["TSL12-01"],
    sourceUrl: "https://telerid.rid.go.th/#/", provider: "rid", providerLabel: "กรมชลประทาน", ridStationId: 720, ridCameraPath: "/1/SKA-TSL12/image.jpg",
  },
];

export function publicCctvCamera(camera: string) {
  const station = cctvStations.find((station) => station.cameras.includes(camera));
  if (!station) return null;
  if (station.provider === "rid" && !station.ridCameraPath) return null;
  const imageUrl = station.provider === "rid"
    ? `https://telerid.rid.go.th/restapi/main/camera${station.ridCameraPath}`
    : `https://cctv.disaster.go.th/api/webrtc/public-frame.jpeg?src=${encodeURIComponent(camera)}`;
  return { station, imageUrl };
}

export function isPublicCctvCamera(camera: string) { return publicCctvCamera(camera) !== null; }
