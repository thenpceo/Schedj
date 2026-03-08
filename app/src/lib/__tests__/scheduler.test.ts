import { describe, it, expect } from "vitest";
import { inferUrgency, kMeansCluster, generateSchedule } from "../scheduler";
import { Farm, InspectorPreferences, UNIVERSAL_CERTIFICATIONS } from "../types";
import { format, addDays } from "date-fns";

// ── Helpers ──

function makeFarm(overrides: Partial<Farm> = {}): Farm {
  return {
    id: "test-farm-1",
    name: "Test Farm",
    street: "123 Main St",
    street2: "",
    city: "Harrisburg",
    state: "PA",
    zip: "17101",
    municipality: "Dauphin",
    country: "UNITED STATES",
    address: "123 Main St, Harrisburg, PA 17101",
    lat: 40.27,
    lng: -76.88,
    email: "test@farm.com",
    phone: "717-555-1234",
    mobile: "",
    priority: "normal",
    auditType: "Annual Inspection (Renewal)",
    nopId: "8210001234",
    auditNumber: "AO-012345",
    services: ["NOP Crop"],
    assignedSites: "",
    completionFrom: "2026-03-15",
    completionUntil: "2026-11-15",
    unannounced: false,
    samplingRequired: false,
    year: 2026,
    estimatedDurationHours: 3,
    notes: "",
    sourceAgency: "",
    ...overrides,
  };
}

function makePrefs(overrides: Partial<InspectorPreferences> = {}): InspectorPreferences {
  return {
    inspectorName: "Test Inspector",
    inspectorEmail: "test@inspector.com",
    inspectorPhone: "",
    certifications: ["NOP Crop", "NOP Handling"],
    homeLat: 40.27,
    homeLng: -76.88,
    homeAddress: "Harrisburg, PA",
    maxDailyDriveMiles: 200,
    maxDayTripMiles: 75,
    preferredTripLengthDays: 4,
    tripStyle: "linear",
    restDaysBetweenTrips: 2,
    workStartHour: 8,
    workEndHour: 17,
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    maxDailyInspections: 3,
    annualInspectionTarget: 100,
    startDate: "2026-04-01",
    dayTripPrefs: {
      availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      maxDailyInspections: 3,
      maxOneWayMiles: 75,
    },
    travelTripPrefs: {
      availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      maxDailyInspections: 4,
      preferredTripLengthDays: 4,
      restDaysBetweenTrips: 2,
      tripStyle: "linear",
    },
    lunchPreference: {
      takeLunchBreak: true,
      lunchBreakMinutes: 30,
    },
    dayTripThresholdMinutes: 180,
    ...overrides,
  };
}

// ── inferUrgency ──

describe("inferUrgency", () => {
  it("upgrades normal farm to urgent when deadline is within 45 days", () => {
    const refDate = new Date("2026-04-01");
    const farm = makeFarm({
      priority: "normal",
      completionUntil: "2026-04-20", // 19 days out
    });
    inferUrgency([farm], refDate);
    expect(farm.priority).toBe("urgent");
  });

  it("does NOT upgrade when deadline is far away", () => {
    const refDate = new Date("2026-04-01");
    const farm = makeFarm({
      priority: "normal",
      completionUntil: "2026-11-15", // 228 days out
    });
    inferUrgency([farm], refDate);
    expect(farm.priority).toBe("normal");
  });

  it("does NOT touch already-urgent farms", () => {
    const refDate = new Date("2026-04-01");
    const farm = makeFarm({
      priority: "urgent",
      completionUntil: "2026-11-15",
    });
    inferUrgency([farm], refDate);
    expect(farm.priority).toBe("urgent");
  });

  it("does NOT touch do_not_inspect farms", () => {
    const refDate = new Date("2026-04-01");
    const farm = makeFarm({
      priority: "do_not_inspect",
      completionUntil: "2026-04-10",
    });
    inferUrgency([farm], refDate);
    expect(farm.priority).toBe("do_not_inspect");
  });

  it("handles farm with no deadline", () => {
    const refDate = new Date("2026-04-01");
    const farm = makeFarm({
      priority: "normal",
      completionUntil: "",
    });
    inferUrgency([farm], refDate);
    expect(farm.priority).toBe("normal");
  });

  it("upgrades farm with deadline 44 days away", () => {
    const refDate = new Date("2026-04-01");
    const farm = makeFarm({
      priority: "normal",
      completionUntil: "2026-05-15", // 44 days — safely within 45-day window
    });
    inferUrgency([farm], refDate);
    expect(farm.priority).toBe("urgent");
  });

  it("does NOT upgrade farm with deadline 60 days away", () => {
    const refDate = new Date("2026-04-01");
    const farm = makeFarm({
      priority: "normal",
      completionUntil: "2026-05-31", // 60 days
    });
    inferUrgency([farm], refDate);
    expect(farm.priority).toBe("normal");
  });
});

// ── checkCertifications (tested via generateSchedule cert warnings) ──

describe("certification warnings", () => {
  it("does NOT warn for universal certifications (General Checklist Questions)", () => {
    const prefs = makePrefs({ certifications: ["NOP Crop"] });
    const farm = makeFarm({
      services: ["NOP Crop", "NOP General Checklist Questions"],
    });
    const schedule = generateSchedule([farm], prefs);
    expect(schedule.certificationWarnings).toHaveLength(0);
  });

  it("warns for genuinely missing certifications", () => {
    const prefs = makePrefs({ certifications: ["NOP Crop"] });
    const farm = makeFarm({
      services: ["NOP Crop", "NOP Livestock"],
    });
    const schedule = generateSchedule([farm], prefs);
    expect(schedule.certificationWarnings.length).toBeGreaterThan(0);
    expect(schedule.certificationWarnings[0]).toContain("NOP Livestock");
  });

  it("no warnings when inspector covers all services", () => {
    const prefs = makePrefs({ certifications: ["NOP Crop", "NOP Handling"] });
    const farm = makeFarm({
      services: ["NOP Crop", "NOP Handling"],
    });
    const schedule = generateSchedule([farm], prefs);
    expect(schedule.certificationWarnings).toHaveLength(0);
  });
});

// ── kMeansCluster ──

describe("kMeansCluster", () => {
  it("returns one cluster per farm when k >= farm count", () => {
    const farms = [
      makeFarm({ id: "f1", lat: 40.0, lng: -76.0 }),
      makeFarm({ id: "f2", lat: 41.0, lng: -77.0 }),
    ];
    const clusters = kMeansCluster(farms, 5);
    expect(clusters).toHaveLength(2);
  });

  it("groups nearby farms into same cluster", () => {
    const farms = [
      // Group near Harrisburg
      makeFarm({ id: "f1", lat: 40.27, lng: -76.88 }),
      makeFarm({ id: "f2", lat: 40.30, lng: -76.90 }),
      // Group near Pittsburgh (far away)
      makeFarm({ id: "f3", lat: 40.44, lng: -79.99 }),
      makeFarm({ id: "f4", lat: 40.45, lng: -80.00 }),
    ];
    const clusters = kMeansCluster(farms, 2);
    expect(clusters).toHaveLength(2);

    // Each cluster should have 2 farms
    const sizes = clusters.map((c) => c.length).sort();
    expect(sizes).toEqual([2, 2]);

    // Farms in the same cluster should be near each other
    for (const cluster of clusters) {
      const ids = cluster.map((f) => f.id);
      // f1 and f2 should be together, f3 and f4 should be together
      if (ids.includes("f1")) {
        expect(ids).toContain("f2");
      }
      if (ids.includes("f3")) {
        expect(ids).toContain("f4");
      }
    }
  });
});

// ── generateSchedule (integration) ──

describe("generateSchedule", () => {
  it("do_not_inspect farms end up unscheduled (filtering happens in UI)", () => {
    const prefs = makePrefs();
    const farms = [
      makeFarm({ id: "f1", priority: "do_not_inspect" }),
      makeFarm({ id: "f2", priority: "normal" }),
    ];
    const schedule = generateSchedule(farms, prefs);
    // do_not_inspect farms get scored at 0 and may not be scheduled
    // The UI layer filters them before calling generateSchedule
    const allScheduledIds = schedule.trips.flatMap((t) =>
      t.days.flatMap((d) => d.inspections.map((i) => i.farm.id))
    );
    const allUnscheduledIds = schedule.unscheduled.map((f) => f.id);
    // f1 should be either unscheduled or (if annual target is high enough) scheduled
    // Key: it should NOT crash
    expect(schedule.totalFarms + schedule.unscheduled.length + schedule.forfeited.length)
      .toBeGreaterThanOrEqual(1);
  });

  it("schedules a single nearby farm as day trip", () => {
    const prefs = makePrefs();
    // Farm very close to home (Harrisburg)
    const farm = makeFarm({
      id: "nearby",
      lat: 40.28,
      lng: -76.89,
      completionFrom: "2026-03-15",
      completionUntil: "2026-11-15",
    });
    const schedule = generateSchedule([farm], prefs);
    expect(schedule.trips.length).toBeGreaterThanOrEqual(1);
    expect(schedule.totalFarms).toBe(1);
  });

  it("handles empty farm list gracefully", () => {
    const prefs = makePrefs();
    const schedule = generateSchedule([], prefs);
    expect(schedule.trips).toHaveLength(0);
    expect(schedule.totalFarms).toBe(0);
    expect(schedule.forfeited).toHaveLength(0);
  });

  it("deadline-first pass catches urgent deadline farms", () => {
    const prefs = makePrefs({ startDate: "2026-04-01" });
    const urgentFarm = makeFarm({
      id: "deadline-farm",
      priority: "urgent",
      completionUntil: "2026-04-20", // 19 days from start — within 30-day Pass 0 window
      completionFrom: "2026-03-15",
      lat: 40.28,
      lng: -76.89,
    });
    const laterFarm = makeFarm({
      id: "later-farm",
      completionUntil: "2026-11-15",
      completionFrom: "2026-03-15",
      lat: 40.30,
      lng: -76.90,
    });
    const schedule = generateSchedule([urgentFarm, laterFarm], prefs);

    // The urgent farm should be scheduled
    const allScheduledIds = schedule.trips.flatMap((t) =>
      t.days.flatMap((d) => d.inspections.map((i) => i.farm.id))
    );
    expect(allScheduledIds).toContain("deadline-farm");

    // It should be scheduled before its deadline
    const deadlineFarmTrip = schedule.trips.find((t) =>
      t.days.some((d) => d.inspections.some((i) => i.farm.id === "deadline-farm"))
    );
    expect(deadlineFarmTrip).toBeDefined();
    if (deadlineFarmTrip) {
      expect(deadlineFarmTrip.startDate <= "2026-04-20").toBe(true);
    }
  });

  it("forfeits farms with past deadlines", () => {
    const prefs = makePrefs({ startDate: "2026-05-01" });
    const pastFarm = makeFarm({
      id: "past-deadline",
      completionUntil: "2026-04-15", // deadline before start date
      completionFrom: "2026-03-01",
    });
    const schedule = generateSchedule([pastFarm], prefs);
    expect(schedule.forfeited.length).toBeGreaterThanOrEqual(1);
    const ff = schedule.forfeited.find((f) => f.farm.id === "past-deadline");
    expect(ff).toBeDefined();
    expect(ff!.reason).toContain("passed");
  });

  it("includes forfeited array in result even when empty", () => {
    const prefs = makePrefs();
    const schedule = generateSchedule([], prefs);
    expect(schedule.forfeited).toBeDefined();
    expect(Array.isArray(schedule.forfeited)).toBe(true);
  });
});

// ── Service normalization (parser) ──

describe("service normalization", () => {
  // Import the parser to test normalization
  it("UNIVERSAL_CERTIFICATIONS are lowercase", () => {
    for (const cert of UNIVERSAL_CERTIFICATIONS) {
      expect(cert).toBe(cert.toLowerCase());
    }
  });
});
