export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV has an unterminated quoted field");
  if (row.length || field) { row.push(field); rows.push(row); }
  const header = rows.shift();
  if (!header || new Set(header).size !== header.length) throw new Error("CSV header is missing or duplicated");
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV record ${index + 2} has ${values.length} columns; expected ${header.length}`);
    return Object.fromEntries(header.map((key, position) => [key, values[position]]));
  });
}

function integer(value) {
  const normalized = value.replace(/,/g, "").replace(/\s*คน\s*$/, "").trim();
  if (!/^\d+(?:\.0+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number <= 2147483647 ? number : null;
}

function decimal(value) {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeShelterRows(rows, { sourceKey, sourceFile, fileHash, scope = "all" }) {
  if (!["all", "phatthalung", "pa-phayom"].includes(scope)) throw new Error("Unknown import scope");
  const seen = new Set();
  return rows.map((raw) => {
    for (const column of ["_id", "จังหวัด", "อำเภอ", "ตำบล", "สถานที่", "รองรับ", "ละติจูด", "ลองจิจูด"]) {
      if (!(column in raw)) throw new Error(`Missing required CSV column: ${column}`);
    }
    const value = (key) => (raw[key] ?? "").trim();
    const sourceId = value("_id");
    if (!/^\d+$/.test(sourceId) || seen.has(sourceId)) throw new Error(`Missing or duplicate source ID: ${sourceId}`);
    seen.add(sourceId);
    const issues = [];
    const capacity = integer(value("รองรับ"));
    const toilets = integer(value("สุขา"));
    if (capacity === null) issues.push(value("รองรับ") ? "capacity_unparseable" : "capacity_missing");
    if (toilets === null && value("สุขา")) issues.push("toilet_count_unparseable");
    if (!value("สถานที่")) issues.push("name_missing");
    const latitude = decimal(value("ละติจูด")), longitude = decimal(value("ลองจิจูด"));
    const coordinateStatus = !value("ละติจูด") || !value("ลองจิจูด") ? "missing"
      : latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ? "invalid"
      : latitude < 5 || latitude > 21 || longitude < 97 || longitude > 106 ? "suspicious" : "valid";
    if (coordinateStatus !== "valid") issues.push(`coordinates_${coordinateStatus}`);
    return {
      source_key: sourceKey, source_id: sourceId, source_file: sourceFile,
      region: value("ภาค"), province: value("จังหวัด"), district: value("อำเภอ"), subdistrict: value("ตำบล"),
      community: value("หมู่บ้าน/ชุมชน"), name: value("สถานที่"), capacity,
      responsible_organization: value("สถานที่รับผิดชอบอปท."), coordinator_name: value("ชื่อ - สกุล ผู้ประสาน"),
      coordinator_phone: value("หมายเลขโทรศัพท์"), electricity: value("ไฟฟ้า"), water_supply: value("ประปา"),
      toilet_count: toilets, latitude, longitude, coordinate_status: coordinateStatus, issues,
      raw_record: raw, file_sha256: fileHash,
    };
  }).filter((row) => scope === "all" || row.province === "พัทลุง" && (scope === "phatthalung" || row.district === "ป่าพะยอม"));
}

export function paPhayomVenues(rows) {
  const venues = new Map();
  for (const row of rows) {
    if (row.province !== "พัทลุง" || row.district !== "ป่าพะยอม" || !row.name || row.capacity === null || row.coordinate_status !== "valid") continue;
    // Community numbers may differ for the same building. Keep every source row, one map point.
    const key = JSON.stringify([row.province, row.district, row.subdistrict, row.name, row.latitude, row.longitude]);
    const venue = venues.get(key);
    if (venue) venue.rows.push(row);
    else venues.set(key, { row, rows: [row] });
  }
  for (const venue of venues.values()) {
    if (venue.rows.length > 1 && new Set(venue.rows.map((row) => row.capacity)).size > 1) throw new Error(`Conflicting capacity for source rows ${venue.rows.map((row) => row.source_id).join(", ")}`);
  }
  return [...venues.values()];
}
