export type GisLayerDefinition = {
  id: string; label: string; group: string; count: number; color: string;
  titleKey?: string; point?: boolean; fields: readonly (readonly [string, string])[];
};
export const GIS_SOURCE_URL = "https://pa-phayom-station-map.dpakorn75.chatgpt.site/";
export const gisLayers: readonly GisLayerDefinition[] = [
  { id: "gis_rain", label: "สถานีวัดน้ำฝนจาก GIS", group: "สถานีจากชุด GIS", count: 8, color: "#2777c8", titleKey: "station_na", point: true, fields: [["รหัส", "id"], ["รหัสเดิม", "oldcode"], ["รหัสหน่วยงาน", "agencyid"]] },
  { id: "gis_water", label: "สถานีระดับน้ำจาก GIS", group: "สถานีจากชุด GIS", count: 15, color: "#0796a8", titleKey: "station_na", point: true, fields: [["รหัส", "id"], ["รหัสหน่วยงาน", "agencyid"]] },
  { id: "gis_auto", label: "จุดสถานีอัตโนมัติจาก GIS", group: "สถานีจากชุด GIS", count: 6, color: "#704fc0", titleKey: "name", point: true, fields: [["รหัส", "id"]] },
  { id: "districts", label: "ขอบเขตอำเภอ", group: "ขอบเขตเพิ่มเติม", count: 9, color: "#b56a00", titleKey: "District_T", fields: [["จังหวัด", "PROV_T"], ["รหัสอำเภอ", "AMPHOE_IDN"], ["พื้นที่ (ตร.กม.)", "Area_km"]] },
  { id: "subdistricts", label: "ขอบเขตตำบล", group: "ขอบเขตเพิ่มเติม", count: 44, color: "#7663d7", titleKey: "TAMBON_T", fields: [["อำเภอ", "District_T"], ["จังหวัด", "PROV_T"], ["รหัสภูมิศาสตร์", "GEOCODE"], ["พื้นที่ (ตร.กม.)", "Area_km"]] },
  { id: "main_stream", label: "แนวลำน้ำหลักจาก GIS", group: "ระบบลำน้ำเพิ่มเติม", count: 1, color: "#1769aa", fields: [] },
  { id: "waterways", label: "ลำน้ำและพื้นที่น้ำจาก GIS", group: "ระบบลำน้ำเพิ่มเติม", count: 45, color: "#2685bd", titleKey: "NAMT", fields: [["ชื่ออังกฤษ", "NAME"], ["ประเภทตามชุดข้อมูล", "PTYPE"]] },
  { id: "villages", label: "หมู่บ้าน / ชุมชน", group: "ชุมชนและความเสี่ยง", count: 107, color: "#5f736f", titleKey: "MUBAN", point: true, fields: [["หมู่ที่", "VILL_NO"], ["ตำบล", "TAMBOL"], ["อำเภอ", "AMPHOE"], ["จังหวัด", "CHANGWAT"], ["รหัสหมู่บ้าน", "DOLACODE"]] },
  { id: "flood_risk", label: "หมู่บ้านเสี่ยงน้ำท่วม (ข้อมูล GIS)", group: "ชุมชนและความเสี่ยง", count: 85, color: "#c84747", titleKey: "MUBAN", point: true, fields: [["หมู่ที่", "VILL_NO"], ["ตำบล", "TAMBOL"], ["อำเภอ", "AMPHOE"], ["ความเสี่ยงตามชุดข้อมูล", "risk"], ["ความถี่ตามชุดข้อมูล", "yeart"], ["ผลกระทบตามชุดข้อมูล", "hight"]] },
  { id: "drought_risk", label: "หมู่บ้านเสี่ยงภัยแล้ง (ข้อมูล GIS)", group: "ชุมชนและความเสี่ยง", count: 44, color: "#d87423", titleKey: "MUBAN", point: true, fields: [["หมู่ที่", "VILL_NO"], ["ตำบล", "tam"], ["อำเภอ", "amp"], ["ความเสี่ยงตามชุดข้อมูล", "riak"], ["ความถี่ตามชุดข้อมูล", "year"], ["ลักษณะปัญหาตามชุดข้อมูล", "hight"]] },
  { id: "landuse", label: "การใช้ประโยชน์ที่ดิน ปี 2563", group: "การใช้ที่ดิน", count: 7219, color: "#65a765", titleKey: "LU_DES_TH", fields: [["รหัส", "LU_CODE"], ["คำอธิบายอังกฤษ", "LU_DES_EN"], ["พื้นที่ตามตาราง (ไร่)", "RAI"]] },
];
export const landuseLegend = [
  { code: "A", label: "เกษตรกรรม", color: "#c5a536" },
  { code: "F", label: "ป่าไม้", color: "#4f8d5a" },
  { code: "M", label: "เบ็ดเตล็ด", color: "#858b90" },
  { code: "U", label: "ชุมชนและสิ่งปลูกสร้าง", color: "#cc7777" },
  { code: "W", label: "แหล่งน้ำ", color: "#399bcb" },
];
export type GisLayerStatus = "loading" | "ready" | "error";
