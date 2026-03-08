import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Farm, Priority } from "./types";

export type DetectedFormat = "intact" | "ccof" | "generic";

export interface ParseResult {
  farms: Farm[];
  skipped: Farm[];
  errors: string[];
  detectedFormat: DetectedFormat;
}

interface RawRow {
  [key: string]: string | number | boolean | undefined;
}

// ── Intact Platform column names (exact match from export) ──
const INTACT_COLUMNS = {
  priority: "Priority",
  auditTypeOriginal: "Audit type (original)",
  plannedOnDate: "Planned On Date",
  completionFrom: "Completion from",
  completionUntil: "Completion until",
  nopId: "File Number (NOP ID)",
  name: "Name",
  servicesOriginal: "Services (original)",
  year: "Year",
  assignedSites: "Assigned sites",
  street: "Street (Add. address)",
  street2: "Street 2 (Add. address)",
  zip: "ZIP code (Add. address)",
  city: "City (Add. address)",
  unannounced: "Audit unannounced",
  municipality: "Municipality (Add. address)",
  samplingRequired: "Sampling required",
  country: "Country (Add. address)",
  email: "Email",
  district: "District (Add. address)",
  mobile: "Mobile",
  state: "State (Add. address)",
  services: "Services",
  phone: "Phone",
  zip2: "ZIP code",
  city2: "City",
  auditType: "Audit type",
  auditNo: "Audit no.",
};

// ── CCOF column names (different Intact Platform configuration) ──
const CCOF_COLUMNS = {
  priority: "Insp Priority",
  name: "Name",
  nopId: "Client ID",
  auditNumber: "Inspection no.",
  servicesOriginal: "Services (original)",
  inspectionType: "Inspection type (original)",
  state: "State",
  country: "Country",
  zip: "ZIP code",
  completionFrom: "Due After",
  completionUntil: "Due by",
  year: "Year",
  assignedSites: "Assigned sites",
  services: "Services",
  idOther: "ID Other",
};

// ── Detect if this is a CCOF export ──
function isCCOFExport(headers: string[]): boolean {
  const hasClientId = headers.includes(CCOF_COLUMNS.nopId);
  const hasDueBy = headers.includes(CCOF_COLUMNS.completionUntil);
  const hasDueAfter = headers.includes(CCOF_COLUMNS.completionFrom);
  return hasClientId && (hasDueBy || hasDueAfter);
}

// ── Detect export format from headers ──
export function detectFormat(headers: string[]): DetectedFormat {
  if (isIntactExport(headers)) return "intact";
  if (isCCOFExport(headers)) return "ccof";
  return "generic";
}

// ── Priority parsing ──
function parsePriority(raw: string): Priority {
  const lower = (raw || "").toLowerCase().trim();
  if (lower.includes("do not inspect")) return "do_not_inspect";
  if (lower.includes("urgent")) return "urgent";
  if (lower === "high") return "urgent"; // CCOF uses "High" for urgent
  if (lower.includes("ready") || lower.includes("normal")) return "normal";
  return "normal";
}

// ── Service name normalization map ──
const SERVICE_NORMALIZATION: Record<string, string> = {
  "nop grower": "NOP Crop",
  "nop crop grower": "NOP Crop",
};

// ── Normalize a single service name ──
function normalizeServiceName(raw: string): string {
  // Strip numbered prefixes: "1.1 NOP Grower" → "NOP Grower"
  let cleaned = raw.replace(/^\d+(\.\d+)*\s+/, "").trim();

  // Check normalization map
  const lower = cleaned.toLowerCase();
  if (SERVICE_NORMALIZATION[lower]) {
    return SERVICE_NORMALIZATION[lower];
  }

  return cleaned;
}

// ── Parse services string (semicolon or comma separated) ──
function parseServices(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((s) => normalizeServiceName(s.trim()))
    .filter(Boolean);
}

// ── Estimate duration based on services ──
function estimateDuration(services: string[]): number {
  // Base: 3 hours for single-scope, +1.5h per additional scope
  if (services.length === 0) return 3;
  if (services.length === 1) return 3;
  if (services.length === 2) return 4.5;
  return 3 + (services.length - 1) * 1.5;
}

// ── Build full address from parts ──
function buildAddress(
  street: string,
  street2: string,
  city: string,
  state: string,
  zip: string
): string {
  const parts = [street, street2, city, state, zip].filter(Boolean);
  if (!city && !state) return parts.join(", ");
  // Format: Street, Street2, City, STATE ZIP
  const addressParts: string[] = [];
  if (street) addressParts.push(street);
  if (street2) addressParts.push(street2);
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  if (cityStateZip) addressParts.push(cityStateZip);
  return addressParts.join(", ");
}

// ── Parse date from various formats ──
function parseDate(raw: string | number | boolean | undefined): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // Handle Excel serial date numbers
  if (typeof raw === "number" || /^\d{5}$/.test(str)) {
    const serial = typeof raw === "number" ? raw : parseInt(str);
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  // Try M/D/YYYY or MM/DD/YYYY
  const slashParts = str.split("/");
  if (slashParts.length === 3) {
    const [m, d, y] = slashParts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  // Try ISO format
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return "";
}

// ── Detect if this is an Intact Platform export ──
function isIntactExport(headers: string[]): boolean {
  const intactKeys = [INTACT_COLUMNS.nopId, INTACT_COLUMNS.priority, INTACT_COLUMNS.completionFrom];
  return intactKeys.some((key) => headers.includes(key));
}

// ── Parse an Intact Platform row into a Farm ──
function parseIntactRow(row: RawRow, index: number): Farm {
  const get = (col: string): string => {
    const val = row[col];
    if (val === undefined || val === null) return "";
    return String(val).trim();
  };
  const getBool = (col: string): boolean => {
    const val = get(col);
    return val.toUpperCase() === "TRUE";
  };

  const street = get(INTACT_COLUMNS.street);
  const street2 = get(INTACT_COLUMNS.street2);
  const city = get(INTACT_COLUMNS.city) || get(INTACT_COLUMNS.city2);
  const state = get(INTACT_COLUMNS.state);
  const zip = get(INTACT_COLUMNS.zip) || get(INTACT_COLUMNS.zip2);
  const services = parseServices(get(INTACT_COLUMNS.servicesOriginal));

  return {
    id: `farm-${index + 1}`,
    name: get(INTACT_COLUMNS.name) || `Operation ${index + 1}`,
    street,
    street2,
    city,
    state,
    zip,
    municipality: get(INTACT_COLUMNS.municipality),
    country: get(INTACT_COLUMNS.country),
    address: buildAddress(street, street2, city, state, zip),
    lat: 0, // Will need geocoding
    lng: 0,
    email: get(INTACT_COLUMNS.email),
    phone: get(INTACT_COLUMNS.phone),
    mobile: get(INTACT_COLUMNS.mobile),
    priority: parsePriority(get(INTACT_COLUMNS.priority)),
    auditType: get(INTACT_COLUMNS.auditTypeOriginal) || get(INTACT_COLUMNS.auditType)?.trim() || "",
    nopId: get(INTACT_COLUMNS.nopId),
    auditNumber: get(INTACT_COLUMNS.auditNo),
    services,
    assignedSites: get(INTACT_COLUMNS.assignedSites),
    completionFrom: parseDate(row[INTACT_COLUMNS.completionFrom]),
    completionUntil: parseDate(row[INTACT_COLUMNS.completionUntil]),
    unannounced: getBool(INTACT_COLUMNS.unannounced),
    samplingRequired: getBool(INTACT_COLUMNS.samplingRequired),
    year: parseInt(get(INTACT_COLUMNS.year)) || new Date().getFullYear(),
    estimatedDurationHours: estimateDuration(services),
    notes: get(INTACT_COLUMNS.assignedSites) ? `Sites: ${get(INTACT_COLUMNS.assignedSites)}` : "",
    sourceAgency: "",
  };
}

// ── Parse a CCOF row into a Farm ──
function parseCCOFRow(row: RawRow, index: number): Farm {
  const get = (col: string): string => {
    const val = row[col];
    if (val === undefined || val === null) return "";
    return String(val).trim();
  };

  const state = get(CCOF_COLUMNS.state);
  const zip = get(CCOF_COLUMNS.zip);
  const services = parseServices(get(CCOF_COLUMNS.servicesOriginal));

  return {
    id: `farm-${index + 1}`,
    name: get(CCOF_COLUMNS.name) || `Operation ${index + 1}`,
    street: "",  // CCOF exports don't include street address
    street2: "",
    city: "",    // CCOF exports don't include city
    state,
    zip,
    municipality: "",
    country: get(CCOF_COLUMNS.country) || "UNITED STATES",
    address: buildAddress("", "", "", state, zip), // ZIP centroid for geocoding
    lat: 0,
    lng: 0,
    email: "",   // CCOF exports don't include email
    phone: "",   // CCOF exports don't include phone
    mobile: "",
    priority: parsePriority(get(CCOF_COLUMNS.priority)),
    auditType: get(CCOF_COLUMNS.inspectionType) || "",
    nopId: get(CCOF_COLUMNS.nopId),
    auditNumber: get(CCOF_COLUMNS.auditNumber),
    services,
    assignedSites: get(CCOF_COLUMNS.assignedSites),
    completionFrom: parseDate(row[CCOF_COLUMNS.completionFrom]),
    completionUntil: parseDate(row[CCOF_COLUMNS.completionUntil]),
    unannounced: false,
    samplingRequired: false,
    year: parseInt(get(CCOF_COLUMNS.year)) || new Date().getFullYear(),
    estimatedDurationHours: estimateDuration(services),
    notes: get(CCOF_COLUMNS.assignedSites) ? `Sites: ${get(CCOF_COLUMNS.assignedSites)}` : "",
    sourceAgency: "",
  };
}

// ── Parse CCOF format ──
function parseCCOFFormat(
  rows: RawRow[],
  errors: string[]
): { farms: Farm[]; skipped: Farm[]; errors: string[] } {
  const allFarms: Farm[] = [];
  const skipped: Farm[] = [];

  for (let i = 0; i < rows.length; i++) {
    const farm = parseCCOFRow(rows[i], i);
    if (!farm.name || farm.name === `Operation ${i + 1}`) {
      continue;
    }
    if (farm.priority === "do_not_inspect") {
      skipped.push(farm);
    } else {
      allFarms.push(farm);
    }
  }

  const urgentCount = allFarms.filter((f) => f.priority === "urgent").length;

  errors.push(`Detected CCOF format (${allFarms.length} inspections).`);
  if (urgentCount > 0) {
    errors.push(`${urgentCount} high-priority inspection(s) will be prioritized.`);
  }
  if (skipped.length > 0) {
    errors.push(`${skipped.length} operation(s) marked "DO NOT INSPECT" were excluded.`);
  }

  const missingCoords = allFarms.filter((f) => f.lat === 0 && f.lng === 0);
  if (missingCoords.length > 0) {
    errors.push(
      `${missingCoords.length} operation(s) need geocoding (no lat/lng). ZIP codes will be used for route estimation.`
    );
  }

  return { farms: allFarms, skipped, errors };
}

// ── Main parse function: handles XLS, XLSX, and CSV ──
export function parseFile(
  data: ArrayBuffer | string,
  fileName: string,
  agency?: string
): ParseResult {
  const errors: string[] = [];
  const ext = fileName.toLowerCase().split(".").pop();

  let rows: RawRow[] = [];
  let headers: string[] = [];

  if (ext === "xls" || ext === "xlsx") {
    // Parse Excel binary
    try {
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON, skipping empty rows
      const rawJson = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });

      if (rawJson.length === 0) {
        errors.push("No data found in the spreadsheet.");
        return { farms: [], skipped: [], errors, detectedFormat: "generic" };
      }

      // Check if first row is a metadata row (Intact exports start with a title row)
      // When XLSX reads it, the metadata text becomes a column KEY (not value)
      const firstRowKeys = Object.keys(rawJson[0]);
      const firstKey = (firstRowKeys[0] || "").toLowerCase();
      const hasMetadataHeader = firstKey.includes("intact") || firstKey.includes("export") || firstKey.includes("created on");
      // Also detect __EMPTY keys which indicate the real headers aren't in row 1
      const hasEmptyKeys = firstRowKeys.filter(k => k.startsWith("__EMPTY")).length > 5;

      if (hasMetadataHeader || hasEmptyKeys) {
        // The metadata row became the header. Re-parse with header from row 2.
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
        range.s.r = 1; // Skip first row (metadata)
        const newSheet = { ...sheet, "!ref": XLSX.utils.encode_range(range) };
        rows = XLSX.utils.sheet_to_json<RawRow>(newSheet, { defval: "" });
      } else {
        rows = rawJson;
      }

      if (rows.length > 0) {
        headers = Object.keys(rows[0]);
      }
    } catch (e) {
      errors.push(`Failed to parse Excel file: ${(e as Error).message}`);
      return { farms: [], skipped: [], errors, detectedFormat: "generic" };
    }
  } else {
    // Parse CSV/TSV
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);

    // Check for Intact metadata header
    const lines = text.split("\n");
    let csvText = text;
    if (lines[0] && (lines[0].toLowerCase().includes("intact") || lines[0].toLowerCase().includes("export"))) {
      csvText = lines.slice(1).join("\n");
    }

    const result = Papa.parse<RawRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (result.errors.length > 0) {
      errors.push(
        ...result.errors.slice(0, 5).map((e) => `Row ${e.row}: ${e.message}`)
      );
    }

    rows = result.data;
    if (rows.length > 0) {
      headers = Object.keys(rows[0]);
    }
  }

  if (rows.length === 0) {
    errors.push("No data rows found in the file.");
    return { farms: [], skipped: [], errors, detectedFormat: "generic" };
  }

  // Filter out completely empty rows
  rows = rows.filter((row) => {
    const vals = Object.values(row);
    return vals.some((v) => v !== "" && v !== undefined && v !== null);
  });

  // Detect format: Intact → CCOF → generic
  const format = detectFormat(headers);

  let result: { farms: Farm[]; skipped: Farm[]; errors: string[] };
  if (format === "intact") {
    result = parseIntactFormat(rows, errors);
  } else if (format === "ccof") {
    result = parseCCOFFormat(rows, errors);
  } else {
    result = parseGenericFormat(rows, headers, errors);
  }

  // Stamp sourceAgency on all farms if provided
  if (agency) {
    for (const farm of result.farms) {
      farm.sourceAgency = agency;
    }
    for (const farm of result.skipped) {
      farm.sourceAgency = agency;
    }
  }

  return { ...result, detectedFormat: format };
}

// ── Parse Intact Platform format ──
function parseIntactFormat(
  rows: RawRow[],
  errors: string[]
): { farms: Farm[]; skipped: Farm[]; errors: string[] } {
  const allFarms: Farm[] = [];
  const skipped: Farm[] = [];

  for (let i = 0; i < rows.length; i++) {
    const farm = parseIntactRow(rows[i], i);
    if (!farm.name || farm.name === `Operation ${i + 1}`) {
      continue; // Skip rows without a name
    }
    if (farm.priority === "do_not_inspect") {
      skipped.push(farm);
    } else {
      allFarms.push(farm);
    }
  }

  // Stats
  const urgentCount = allFarms.filter((f) => f.priority === "urgent").length;
  const normalCount = allFarms.filter((f) => f.priority === "normal").length;

  if (urgentCount > 0) {
    errors.push(`${urgentCount} urgent inspection(s) will be prioritized.`);
  }
  if (skipped.length > 0) {
    errors.push(
      `${skipped.length} operation(s) marked "DO NOT INSPECT" were excluded.`
    );
  }

  // Warn about missing coordinates
  const missingCoords = allFarms.filter((f) => f.lat === 0 && f.lng === 0);
  if (missingCoords.length > 0) {
    errors.push(
      `${missingCoords.length} operation(s) need geocoding (no lat/lng). Addresses will be used for route estimation.`
    );
  }

  return { farms: allFarms, skipped, errors };
}

// ── Fallback: generic CSV with flexible column names ──
const FIELD_MAPPINGS: Record<string, string[]> = {
  name: ["name", "farm name", "farm_name", "operation", "operation name", "business name", "client name"],
  street: ["street", "address", "farm address", "street address", "street (add. address)"],
  city: ["city", "city (add. address)"],
  state: ["state", "state (add. address)"],
  zip: ["zip", "zip code", "zipcode", "zip code (add. address)"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "long", "longitude"],
  email: ["email", "e-mail"],
  phone: ["phone", "telephone", "phone number"],
  services: ["services", "services (original)", "cert type", "certification type"],
  completionFrom: ["completion from", "start date", "window start", "due after"],
  completionUntil: ["completion until", "end date", "deadline", "window end", "due by"],
  priority: ["priority", "insp priority"],
  nopId: ["file number", "nop id", "file number (nop id)", "client id"],
  auditType: ["audit type", "audit type (original)", "inspection type", "inspection type (original)"],
  auditNumber: ["audit no", "audit no.", "audit number", "inspection no", "inspection no."],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\-]/g, " ");
}

function mapField(header: string): string | null {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(FIELD_MAPPINGS)) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

function parseGenericFormat(
  rows: RawRow[],
  headers: string[],
  errors: string[]
): { farms: Farm[]; skipped: Farm[]; errors: string[] } {
  const headerMap: Record<string, string> = {};
  for (const h of headers) {
    const mapped = mapField(h);
    if (mapped) headerMap[mapped] = h;
  }

  if (!headerMap.name) {
    errors.push(
      `Could not find a "Name" column. Found columns: ${headers.join(", ")}`
    );
    return { farms: [], skipped: [], errors };
  }

  const farms: Farm[] = [];
  const skipped: Farm[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const get = (field: string, fallback = ""): string => {
      const col = headerMap[field];
      if (!col) return fallback;
      const val = row[col];
      return val !== undefined && val !== null ? String(val).trim() : fallback;
    };

    const lat = parseFloat(get("lat", "0"));
    const lng = parseFloat(get("lng", "0"));
    const services = parseServices(get("services"));
    const priority = parsePriority(get("priority"));
    const street = get("street");
    const city = get("city");
    const state = get("state");
    const zip = get("zip");

    const farm: Farm = {
      id: `farm-${i + 1}`,
      name: get("name", `Farm ${i + 1}`),
      street,
      street2: "",
      city,
      state,
      zip,
      municipality: "",
      country: "UNITED STATES",
      address: buildAddress(street, "", city, state, zip),
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lng) ? 0 : lng,
      email: get("email"),
      phone: get("phone"),
      mobile: "",
      priority,
      auditType: get("auditType"),
      nopId: get("nopId"),
      auditNumber: get("auditNumber"),
      services,
      assignedSites: "",
      completionFrom: parseDate(row[headerMap.completionFrom || ""]),
      completionUntil: parseDate(row[headerMap.completionUntil || ""]),
      unannounced: false,
      samplingRequired: false,
      year: new Date().getFullYear(),
      estimatedDurationHours: estimateDuration(services),
      notes: "",
      sourceAgency: "",
    };

    if (priority === "do_not_inspect") {
      skipped.push(farm);
    } else {
      farms.push(farm);
    }
  }

  return { farms, skipped, errors };
}

// ── CSV template for download ──
export function generateCSVTemplate(): string {
  const headers = [
    "Priority",
    "Name",
    "Street",
    "City",
    "State",
    "ZIP code",
    "Email",
    "Phone",
    "Services",
    "Completion from",
    "Completion until",
    "Audit type",
    "File Number (NOP ID)",
    "Audit no.",
  ];
  return headers.join(",") + "\n";
}

// Keep backward compat for any old CSV imports
export const parseCSV = (text: string): ParseResult => parseFile(text, "data.csv");
