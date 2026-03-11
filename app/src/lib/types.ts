export type Priority = "urgent" | "normal" | "do_not_inspect";
export type TripType = "day_trip" | "multi_day";

// ── Constants ──
export const IRS_MILEAGE_RATE = 0.70;       // $/mile 2025
export const HOTEL_NIGHTLY_RATE = 120;       // $/night estimate
export const LUNCH_BREAK_MINUTES = 30;
export const DEFAULT_DAY_TRIP_THRESHOLD_MINUTES = 180; // 3 hours one-way
export const AVAILABLE_CERTIFICATIONS = [
  "NOP Crop",
  "NOP Handling",
  "NOP Livestock",
  "NOP Wild Crop",
  "US/Canada Equivalence",
  "COR/USCOEA",
];

// Certifications that every inspector holds — skip in cert-check
export const UNIVERSAL_CERTIFICATIONS = [
  "general checklist questions",
  "nop general checklist questions",
];

export interface Farm {
  id: string;
  name: string;
  // Address fields
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  municipality: string; // county
  country: string;
  // Full constructed address for display/geocoding
  address: string;
  lat: number;
  lng: number;
  // Contact
  email: string;
  phone: string;
  mobile: string;
  // Intact Platform fields
  priority: Priority;
  auditType: string; // e.g., "Annual Inspection (Renewal)"
  nopId: string; // File Number
  auditNumber: string; // e.g., "AO-016755"
  services: string[]; // e.g., ["NOP Crop", "NOP Handling"]
  assignedSites: string;
  completionFrom: string; // ISO date - earliest allowed inspection date
  completionUntil: string; // ISO date - deadline
  unannounced: boolean;
  samplingRequired: boolean;
  year: number;
  // Scheduling
  estimatedDurationHours: number;
  notes: string;
  // Multi-agency support
  sourceAgency: string;
}

// ── Separate preferences for day trips vs. travel trips ──
export interface DayTripPreferences {
  availableDays: string[];       // e.g., ["Mon", "Wed", "Fri"]
  maxDailyInspections: number;
  maxOneWayMiles: number;        // max one-way distance for day trips
}

export interface TravelTripPreferences {
  availableDays: string[];       // typically all 7 days on travel
  maxDailyInspections: number;
  preferredTripLengthDays: number;
  restDaysBetweenTrips: number;
  tripStyle: "pinwheel" | "linear";
}

export interface LunchPreference {
  takeLunchBreak: boolean;       // false = eat while driving
  lunchBreakMinutes: number;     // only used if takeLunchBreak = true
}

export interface InspectorPreferences {
  // Inspector profile
  inspectorName: string;
  inspectorEmail: string;
  inspectorPhone: string;
  certifications: string[];
  // Home base
  homeLat: number;
  homeLng: number;
  homeAddress: string;
  // Travel limits
  maxDailyDriveMiles: number;
  maxDayTripMiles: number; // max one-way distance for day trips (no overnight)
  // Trip planning
  preferredTripLengthDays: number;
  tripStyle: "pinwheel" | "linear";
  restDaysBetweenTrips: number;
  // Work schedule
  workStartHour: number; // 0-23
  workEndHour: number; // 0-23
  availableDays: string[]; // e.g., ["Mon", "Tue", "Wed", "Thu", "Fri"]
  maxDailyInspections: number;
  // Scheduling
  annualInspectionTarget: number;
  startDate: string; // ISO date - when to start scheduling
  // ── v2: Day trip vs. travel trip split ──
  dayTripPrefs: DayTripPreferences;
  travelTripPrefs: TravelTripPreferences;
  lunchPreference: LunchPreference;
  dayTripThresholdMinutes: number; // one-way drive time cutoff (default 180 = 3h)
}

export interface ScheduledInspection {
  farm: Farm;
  date: string; // ISO date
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  driveTimeFromPrevMinutes: number;
  driveDistanceFromPrevMiles: number;
  contactStatus: "not_contacted" | "emailed" | "called" | "confirmed";
}

export interface TripDay {
  date: string;
  dayLabel: string; // e.g., "Day 1"
  inspections: ScheduledInspection[];
  totalDriveMiles: number;
  totalDriveMinutes: number;
  totalInspectionHours: number;
  // Drive from/to home (day 1 and last day)
  driveFromHomeMiles: number;
  driveFromHomeMinutes: number;
  driveToHomeMiles: number;
  driveToHomeMinutes: number;
}

export interface Trip {
  id: string;
  tripNumber: number;
  days: TripDay[];
  totalFarms: number;
  totalMiles: number;
  startDate: string;
  endDate: string;
  estimatedTravelCost: number;
  overnightsRequired: number;
  // v2
  tripType: TripType;
  clusterId?: string; // links back to FarmCluster
}

export interface ForfeitedFarm {
  farm: Farm;
  reason: string;
}

export interface Schedule {
  trips: Trip[];
  unscheduled: Farm[]; // farms that couldn't be fit
  skipped: Farm[]; // farms marked DO NOT INSPECT
  forfeited: ForfeitedFarm[]; // farms whose deadlines cannot be met
  totalFarms: number;
  totalTrips: number;
  dateRange: { start: string; end: string };
  totalEstimatedCost: number;
  certificationWarnings: string[];
}

export interface ContactScript {
  emailSubject: string;
  emailBody: string;
  callScript: string;
}

// ── App steps (V2 + V3) ──
// V2 steps kept for backward compat until Phase 3 replaces page.tsx
export type AppStep = "upload" | "analyze" | "plan" | "preferences" | "workspace" | "contact";
export type WorkspaceTab = "trips" | "calendar" | "map";

// ── v2: Region analysis types ──
export interface FarmCluster {
  id: string;
  label: string;                    // e.g., "Central Pennsylvania"
  farms: Farm[];
  centroid: { lat: number; lng: number };
  avgDistanceFromHomeMiles: number;
  driveTimeFromHomeMinutes: number;
  tripType: TripType;
  urgentCount: number;
  totalEstimatedHours: number;
  suggestedTripDays: number;
  completionWindows: { earliest: string; latest: string };
}

export interface RegionAnalysis {
  clusters: FarmCluster[];
  dayTripFarms: Farm[];
  multiDayFarms: Farm[];
  totalFarms: number;
  urgentFarms: Farm[];
  warnings: string[];
}

// ── v2: Trip planning types ──
export interface TripPlan {
  clusterId: string;
  tripType: TripType;
  preferredMonth?: string;         // "2026-03", "2026-04", etc.
  preferredStartDate?: string;     // ISO date
  locked: boolean;
  farms: Farm[];
}

// ── v2: Schedule editing types ──
export interface ScheduleEdit {
  type: "move_inspection" | "change_date" | "mark_unavailable" | "remove_inspection"
    | "split_trip" | "merge_trips" | "move_farms" | "reorder_farms";
  inspectionFarmId: string;
  fromDate?: string;
  toDate?: string;
  unavailableDates?: string[];
  // V3 extensions
  fromTripId?: string;
  toTripId?: string;
  farmIds?: string[];
  splitAfterDay?: number;
}

// ── V3: Hotel suggestion ──
export interface HotelSuggestion {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

// ── V3: Window violation (soft warning) ──
export interface WindowViolation {
  farmId: string;
  farmName: string;
  reason: string;           // e.g., "Trip starts before inspection window opens"
  completionFrom?: string;  // ISO date
  completionUntil?: string; // ISO date
  tripStartDate?: string;
  tripEndDate?: string;
}

// ── V3: Trip with V3 extensions ──
export interface TripV3 extends Trip {
  hotelSuggestion?: HotelSuggestion;
  windowViolations: WindowViolation[];
  isUserEdited: boolean;    // true if user has manually modified this trip
}

// ── V3: Returned farm (denied by inspector) ──
export interface ReturnedFarm {
  farm: Farm;
  reason: string;
  returnedAt: string; // ISO timestamp
}

// ── V3: Trip state for undo/redo ──
export interface TripState {
  trips: TripV3[];
  needsLocationFarms: Farm[];
  returnedFarms: ReturnedFarm[];
  timestamp: number;
}

// ── V3: Undo/redo history (immutable state stack) ──
export interface TripEditHistory {
  past: TripState[];     // max 50
  present: TripState;
  future: TripState[];   // redo stack
}

// ── V3: Schedule score summary ──
export interface ScheduleScore {
  coveragePercent: number;      // scheduled / total inspectable
  totalEstimatedCost: number;
  avgDriveTimeMinutes: number;
  totalTrips: number;
  totalDayTrips: number;
  totalTravelTrips: number;
  windowViolationCount: number;
}

// ── V3: Travel prefs (frozen after schedule generation) ──
export interface TravelPrefs {
  maxDaysAway: number;
  maxDrivingDistanceMiles: number;  // beyond this = fly
  inspectionsPerDay: number;
  maxLocalDrivingRadiusMiles: number;
  workStartHour: number;
  workEndHour: number;
  availableDays: string[];
}

// ── V3: Day trip prefs (mutable in workspace sidebar) ──
export interface DayTripPrefsV3 {
  availableDays: string[];
  maxInspectionsPerDay: number;
  maxOneWayMiles: number;
}

// ── V3: Workspace action types ──
export type WorkspaceAction =
  | { type: "MOVE_FARMS"; farmIds: string[]; toTripId: string }
  | { type: "SPLIT_TRIP"; tripId: string; afterDay: number }
  | { type: "MERGE_TRIPS"; tripIdA: string; tripIdB: string }
  | { type: "REORDER_FARMS"; tripId: string; farmIds: string[] }
  | { type: "RETURN_FARMS"; farmIds: string[]; reason: string }
  | { type: "RESTORE_FARM"; farmId: string }
  | { type: "NEW_TRIP_FROM_FARMS"; farmIds: string[] }
  | { type: "UPDATE_DAY_TRIP_PREFS"; prefs: DayTripPrefsV3 }
  | { type: "SET_SELECTED_FARMS"; farmIds: Set<string> }
  | { type: "TOGGLE_FARM_SELECTION"; farmId: string }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_ACTIVE_TAB"; tab: WorkspaceTab }
  | { type: "SET_EXPANDED_TRIP"; tripId: string | null }
  | { type: "SET_HOVERED_FARM"; farmId: string | null }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_TRIPS"; trips: TripV3[] }
  | { type: "UPDATE_FARM_LOCATION"; farmId: string; lat: number; lng: number; address: string };

// ── V3: Workspace context state ──
export interface WorkspaceState {
  trips: TripV3[];
  farms: Farm[];
  selectedFarmIds: Set<string>;
  expandedTripId: string | null;
  hoveredFarmId: string | null;
  activeTab: WorkspaceTab;
  tripHistory: TripEditHistory;
  needsLocationFarms: Farm[];
  returnedFarms: ReturnedFarm[];
  scheduleScore: ScheduleScore;
  travelPrefs: TravelPrefs;
  travelPrefsLockedAt: Date | null;
  dayTripPrefs: DayTripPrefsV3;
}
