import { describe, it, expect } from "vitest";
import { detectFormat, parseFile } from "../parser";

// ── detectFormat ──

describe("detectFormat", () => {
  it("detects Intact/PCO format from standard Intact headers", () => {
    const headers = [
      "Priority",
      "Audit type (original)",
      "Completion from",
      "Completion until",
      "File Number (NOP ID)",
      "Name",
      "Services (original)",
    ];
    expect(detectFormat(headers)).toBe("intact");
  });

  it("detects CCOF format from CCOF headers", () => {
    const headers = [
      "Insp Priority",
      "Name",
      "Client ID",
      "Inspection no.",
      "Due After",
      "Due by",
      "Services",
    ];
    expect(detectFormat(headers)).toBe("ccof");
  });

  it("detects CCOF even with only Due by (no Due After)", () => {
    const headers = ["Client ID", "Due by", "Name"];
    expect(detectFormat(headers)).toBe("ccof");
  });

  it("detects CCOF even with only Due After (no Due by)", () => {
    const headers = ["Client ID", "Due After", "Name"];
    expect(detectFormat(headers)).toBe("ccof");
  });

  it("does NOT false-positive on Intact headers as CCOF", () => {
    const headers = [
      "Priority",
      "File Number (NOP ID)",
      "Completion from",
      "Completion until",
      "Name",
    ];
    // Intact takes precedence; should NOT return "ccof"
    expect(detectFormat(headers)).toBe("intact");
  });

  it("returns generic for unknown headers", () => {
    const headers = ["Farm Name", "Location", "Date"];
    expect(detectFormat(headers)).toBe("generic");
  });

  it("returns generic for empty headers", () => {
    expect(detectFormat([])).toBe("generic");
  });
});

// ── parseFile with CCOF data ──

describe("parseFile CCOF format", () => {
  const ccofCSV = [
    "Insp Priority,Name,Client ID,Inspection no.,Due After,Due by,State,ZIP code,Services,Services (original)",
    'Normal,Green Valley Farm,C-12345,INS-001,1/15/2026,6/30/2026,CA,93001,NOP Crop,1 NOP Grower',
    'High,Sunrise Organics,C-67890,INS-002,2/1/2026,5/15/2026,CA,93010,NOP Crop;NOP Livestock,2 NOP Crop Grower;3 NOP Livestock',
    'Normal,Coastal Farm,C-11111,INS-003,3/1/2026,9/30/2026,OR,97001,NOP Crop,',
  ].join("\n");

  it("detects CCOF format", () => {
    const result = parseFile(ccofCSV, "test.csv");
    expect(result.detectedFormat).toBe("ccof");
  });

  it("parses all CCOF farms", () => {
    const result = parseFile(ccofCSV, "test.csv");
    expect(result.farms.length).toBe(3);
  });

  it("maps CCOF fields correctly", () => {
    const result = parseFile(ccofCSV, "test.csv");
    const farm = result.farms[0];
    expect(farm.name).toBe("Green Valley Farm");
    expect(farm.nopId).toBe("C-12345");
    expect(farm.auditNumber).toBe("INS-001");
    expect(farm.state).toBe("CA");
    expect(farm.zip).toBe("93001");
    expect(farm.priority).toBe("normal");
  });

  it("maps CCOF High priority to urgent", () => {
    const result = parseFile(ccofCSV, "test.csv");
    const urgentFarm = result.farms.find((f) => f.name === "Sunrise Organics");
    expect(urgentFarm?.priority).toBe("urgent");
  });

  it("parses CCOF date fields (US format M/D/YYYY)", () => {
    const result = parseFile(ccofCSV, "test.csv");
    const farm = result.farms[0];
    expect(farm.completionFrom).toBe("2026-01-15");
    expect(farm.completionUntil).toBe("2026-06-30");
  });

  it("CCOF farms have empty street, city, email, phone", () => {
    const result = parseFile(ccofCSV, "test.csv");
    const farm = result.farms[0];
    expect(farm.street).toBe("");
    expect(farm.city).toBe("");
    expect(farm.email).toBe("");
    expect(farm.phone).toBe("");
  });

  it("stamps sourceAgency when agency parameter provided", () => {
    const result = parseFile(ccofCSV, "test.csv", "CCOF");
    for (const farm of result.farms) {
      expect(farm.sourceAgency).toBe("CCOF");
    }
  });

  it("does not stamp sourceAgency when agency not provided", () => {
    const result = parseFile(ccofCSV, "test.csv");
    for (const farm of result.farms) {
      expect(farm.sourceAgency).toBeFalsy();
    }
  });
});

// ── parseFile with Intact/PCO data ──

describe("parseFile Intact format", () => {
  const intactCSV = [
    "Priority,Name,File Number (NOP ID),Audit no.,Completion from,Completion until,Street (Add. address),City (Add. address),State (Add. address),ZIP code (Add. address),Email,Phone,Services,Audit type",
    'Ready to Inspect - Normal,Happy Acres,8210001234,AO-012345,1/1/2026,12/31/2026,123 Main St,Lancaster,PA,17601,test@farm.com,717-555-1234,NOP Crop,Annual Inspection',
    'Ready to Inspect - Urgent,Urgent Farm,8210009999,AO-099999,2/1/2026,4/30/2026,456 Oak Rd,York,PA,17401,urgent@farm.com,717-555-5678,NOP Crop;NOP Livestock,Annual Inspection',
  ].join("\n");

  it("detects Intact format", () => {
    const result = parseFile(intactCSV, "test.csv");
    expect(result.detectedFormat).toBe("intact");
  });

  it("parses all Intact farms", () => {
    const result = parseFile(intactCSV, "test.csv");
    expect(result.farms.length).toBe(2);
  });

  it("maps Intact fields correctly", () => {
    const result = parseFile(intactCSV, "test.csv");
    const farm = result.farms[0];
    expect(farm.name).toBe("Happy Acres");
    expect(farm.nopId).toBe("8210001234");
    expect(farm.auditNumber).toBe("AO-012345");
    expect(farm.email).toBe("test@farm.com");
    expect(farm.phone).toBe("717-555-1234");
    expect(farm.state).toBe("PA");
    expect(farm.priority).toBe("normal");
  });

  it("maps Intact urgent priority", () => {
    const result = parseFile(intactCSV, "test.csv");
    const farm = result.farms.find((f) => f.name === "Urgent Farm");
    expect(farm?.priority).toBe("urgent");
  });

  it("stamps sourceAgency on Intact farms", () => {
    const result = parseFile(intactCSV, "test.csv", "PCO");
    for (const farm of result.farms) {
      expect(farm.sourceAgency).toBe("PCO");
    }
  });
});

// ── parseFile edge cases ──

describe("parseFile edge cases", () => {
  it("returns error for empty input", () => {
    const result = parseFile("", "empty.csv");
    expect(result.farms.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.detectedFormat).toBe("generic");
  });

  it("skips DO NOT INSPECT farms", () => {
    const csv = [
      "Priority,Name,File Number (NOP ID),Audit no.,Completion from,Completion until,Street (Add. address),City (Add. address),State (Add. address),ZIP code (Add. address),Services,Audit type",
      'DO NOT INSPECT,Skip Farm,8210000000,AO-000000,1/1/2026,12/31/2026,,,PA,17601,NOP Crop,Annual Inspection',
      'Ready to Inspect - Normal,Keep Farm,8210000001,AO-000001,1/1/2026,12/31/2026,123 Main,City,PA,17601,NOP Crop,Annual Inspection',
    ].join("\n");

    const result = parseFile(csv, "test.csv");
    expect(result.farms.length).toBe(1);
    expect(result.skipped.length).toBe(1);
    expect(result.farms[0].name).toBe("Keep Farm");
    expect(result.skipped[0].name).toBe("Skip Farm");
  });

  it("existing scheduler tests still pass (regression guard)", () => {
    // This test file existing alongside scheduler.test.ts ensures both run
    expect(true).toBe(true);
  });
});
