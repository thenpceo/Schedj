import {
  Farm,
  InspectorPreferences,
  Schedule,
  Trip,
  TripDay,
  TripPlan,
  TripType,
  ScheduledInspection,
  IRS_MILEAGE_RATE,
  HOTEL_NIGHTLY_RATE,
  LUNCH_BREAK_MINUTES,
} from "./types";
import {
  haversineDistance,
  driveDistanceBetween,
  driveTimeBetween,
  buildDistanceMatrix,
} from "./geo";
import { generateContactScript } from "./contact-scripts";
import { addDays, format, parseISO, getDay, differenceInCalendarDays } from "date-fns";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Main entry point ──
export function generateSchedule(
  farms: Farm[],
  prefs: InspectorPreferences,
  tripPlans?: TripPlan[],
  farmUnavailableDates?: Record<string, string[]>
): Schedule {
  if (farms.length === 0) {
    return emptySchedule();
  }

  // Stage 0: Certification check
  const certificationWarnings = checkCertifications(farms, prefs);

  // Stage 1: Score farms by urgency & date proximity
  const startDate = parseISO(prefs.startDate);
  const scored = farms.map((f) => ({
    farm: f,
    score: scoreFarm(f, startDate),
  }));

  // Stage 1b: Enforce annual inspection target — select top N by score
  const targetCount = Math.min(prefs.annualInspectionTarget, farms.length);
  const sortedByScore = [...scored].sort((a, b) => b.score - a.score);
  const selectedFarms = sortedByScore.slice(0, targetCount).map((s) => s.farm);
  const deferredFarms = sortedByScore.slice(targetCount).map((s) => s.farm);

  // ── v2: Two-phase scheduling if trip plans provided ──
  if (tripPlans && tripPlans.length > 0) {
    return generateTwoPhaseSchedule(
      selectedFarms, deferredFarms, prefs, tripPlans,
      scored, certificationWarnings, startDate, farmUnavailableDates
    );
  }

  // ── Legacy single-phase scheduling ──
  return generateSinglePhaseSchedule(
    selectedFarms, deferredFarms, prefs, scored,
    certificationWarnings, startDate, farmUnavailableDates
  );
}

// ── v2: Two-phase scheduling (multi-day first, then day trips) ──
function generateTwoPhaseSchedule(
  selectedFarms: Farm[],
  deferredFarms: Farm[],
  prefs: InspectorPreferences,
  tripPlans: TripPlan[],
  scored: { farm: Farm; score: number }[],
  certificationWarnings: string[],
  startDate: Date,
  farmUnavailableDates?: Record<string, string[]>
): Schedule {
  const trips: Trip[] = [];
  const scheduled = new Set<string>();
  const blockedDates = new Set<string>(); // dates consumed by multi-day trips

  // Phase 1: Schedule multi-day trips (user-planned)
  const multiDayPlans = tripPlans
    .filter((p) => p.tripType === "multi_day" && p.locked && p.farms.length > 0)
    .sort((a, b) => {
      const dateA = a.preferredStartDate || "9999";
      const dateB = b.preferredStartDate || "9999";
      return dateA.localeCompare(dateB);
    });

  for (const plan of multiDayPlans) {
    const planStart = plan.preferredStartDate
      ? parseISO(plan.preferredStartDate)
      : new Date(startDate);

    // Use travel trip prefs: all available days, maxed out
    const travelPrefs: InspectorPreferences = {
      ...prefs,
      availableDays: prefs.travelTripPrefs?.availableDays || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      maxDailyInspections: prefs.travelTripPrefs?.maxDailyInspections || prefs.maxDailyInspections,
      preferredTripLengthDays: prefs.travelTripPrefs?.preferredTripLengthDays || prefs.preferredTripLengthDays,
      tripStyle: prefs.travelTripPrefs?.tripStyle || prefs.tripStyle,
    };

    const ordered = optimizeRoute(plan.farms, travelPrefs);
    const tripDays = packIntoDays(ordered, travelPrefs, planStart, farmUnavailableDates);
    if (tripDays.length === 0) continue;

    const scheduledInTrip = new Set<string>();
    for (const day of tripDays) {
      blockedDates.add(day.date);
      for (const insp of day.inspections) {
        scheduled.add(insp.farm.id);
        scheduledInTrip.add(insp.farm.id);
      }
    }

    const trip = buildTrip(trips.length, tripDays, plan.farms.filter(f => scheduledInTrip.has(f.id)), prefs, "multi_day", plan.clusterId);
    trips.push(trip);
  }

  // Phase 2: Schedule day trips (auto-scheduled around multi-day trips)
  const dayTripFarms = selectedFarms.filter((f) => !scheduled.has(f.id));
  if (dayTripFarms.length > 0) {
    const dayTripPrefs: InspectorPreferences = {
      ...prefs,
      availableDays: prefs.dayTripPrefs?.availableDays || prefs.availableDays,
      maxDailyInspections: prefs.dayTripPrefs?.maxDailyInspections || prefs.maxDailyInspections,
      preferredTripLengthDays: 1, // day trips are always 1 day
    };

    const dayTrips = scheduleDayTrips(
      dayTripFarms, dayTripPrefs, scored, startDate, blockedDates, farmUnavailableDates
    );

    for (const trip of dayTrips) {
      trip.tripNumber = trips.length + 1;
      trip.id = `trip-${trip.tripNumber}`;
      trips.push(trip);
      for (const day of trip.days) {
        for (const insp of day.inspections) {
          scheduled.add(insp.farm.id);
        }
      }
    }
  }

  // Sort all trips by start date
  trips.sort((a, b) => a.startDate.localeCompare(b.startDate));
  trips.forEach((t, i) => { t.tripNumber = i + 1; t.id = `trip-${i + 1}`; });

  return buildScheduleResult(trips, selectedFarms, deferredFarms, scheduled, certificationWarnings);
}

// Schedule day trips: cluster nearby farms, 1-day trips
function scheduleDayTrips(
  farms: Farm[],
  prefs: InspectorPreferences,
  scored: { farm: Farm; score: number }[],
  startDate: Date,
  blockedDates: Set<string>,
  farmUnavailableDates?: Record<string, string[]>
): Trip[] {
  const trips: Trip[] = [];
  const scheduled = new Set<string>();

  // Cluster day trip farms
  const avgDuration = farms.reduce((s, f) => s + f.estimatedDurationHours, 0) / farms.length;
  const workHours = prefs.workEndHour - prefs.workStartHour;
  const farmsPerDay = Math.min(prefs.maxDailyInspections, Math.max(1, Math.floor(workHours / avgDuration)));
  const k = Math.max(1, Math.ceil(farms.length / Math.max(1, farmsPerDay)));
  const clusters = kMeansCluster(farms, k);

  // Sort clusters by urgency
  const scoredClusters = clusters.map((cluster) => {
    const maxScore = Math.max(...cluster.map((f) => scored.find((s) => s.farm.id === f.id)?.score ?? 0));
    return { farms: cluster, maxScore };
  });
  scoredClusters.sort((a, b) => b.maxScore - a.maxScore);

  let currentDate = new Date(startDate);

  for (const cluster of scoredClusters) {
    let remainingFarms = cluster.farms.filter((f) => !scheduled.has(f.id));
    if (remainingFarms.length === 0) continue;

    while (remainingFarms.length > 0) {
      // Advance to earliest completion window
      const earliestWindow = remainingFarms
        .filter((f) => f.completionFrom)
        .map((f) => parseISO(f.completionFrom))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (earliestWindow && currentDate < earliestWindow) {
        currentDate = new Date(earliestWindow);
      }

      // Skip blocked dates (used by multi-day trips)
      currentDate = skipToAvailableDay(currentDate, prefs);
      let safety = 0;
      while (blockedDates.has(format(currentDate, "yyyy-MM-dd")) && safety < 365) {
        currentDate = addDays(currentDate, 1);
        currentDate = skipToAvailableDay(currentDate, prefs);
        safety++;
      }

      const ordered = optimizeRoute(remainingFarms, prefs);
      const tripDays = packIntoDays(ordered, prefs, currentDate, farmUnavailableDates);
      if (tripDays.length === 0) break;

      const scheduledInTrip = new Set<string>();
      for (const day of tripDays) {
        for (const insp of day.inspections) {
          scheduled.add(insp.farm.id);
          scheduledInTrip.add(insp.farm.id);
        }
      }

      const trip = buildTrip(trips.length, tripDays, remainingFarms.filter(f => scheduledInTrip.has(f.id)), prefs, "day_trip");
      trips.push(trip);

      const lastTripDate = parseISO(tripDays[tripDays.length - 1].date);
      currentDate = addDays(lastTripDate, 1);
      remainingFarms = remainingFarms.filter((f) => !scheduledInTrip.has(f.id));
    }
  }

  return trips;
}

// ── Legacy single-phase scheduling (backward-compatible) ──
function generateSinglePhaseSchedule(
  selectedFarms: Farm[],
  deferredFarms: Farm[],
  prefs: InspectorPreferences,
  scored: { farm: Farm; score: number }[],
  certificationWarnings: string[],
  startDate: Date,
  farmUnavailableDates?: Record<string, string[]>
): Schedule {
  // Stage 2: Geographic clustering (only selected farms)
  const avgDuration =
    selectedFarms.reduce((s, f) => s + f.estimatedDurationHours, 0) / selectedFarms.length;
  const workHours = prefs.workEndHour - prefs.workStartHour;
  const farmsPerDay = Math.min(
    prefs.maxDailyInspections,
    Math.max(1, Math.floor(workHours / avgDuration))
  );
  const farmsPerTrip = farmsPerDay * prefs.preferredTripLengthDays;
  const k = Math.max(1, Math.ceil(selectedFarms.length / Math.max(1, farmsPerTrip)));

  const clusters = kMeansCluster(selectedFarms, k);

  // Sort clusters: most urgent first (highest max score in cluster)
  const scoredClusters = clusters.map((cluster) => {
    const maxScore = Math.max(
      ...cluster.map((f) => scored.find((s) => s.farm.id === f.id)!.score)
    );
    return { farms: cluster, maxScore };
  });

  if (prefs.tripStyle === "pinwheel") {
    scoredClusters.sort((a, b) => {
      const centroidA = centroid(a.farms);
      const centroidB = centroid(b.farms);
      const angleA = Math.atan2(centroidA.lat - prefs.homeLat, centroidA.lng - prefs.homeLng);
      const angleB = Math.atan2(centroidB.lat - prefs.homeLat, centroidB.lng - prefs.homeLng);
      return angleA - angleB;
    });
  } else {
    scoredClusters.sort((a, b) => b.maxScore - a.maxScore);
  }

  // Stage 3 & 4: Optimize routes and pack into days
  const trips: Trip[] = [];
  const scheduled = new Set<string>();
  let currentDate = new Date(startDate);

  for (const cluster of scoredClusters) {
    let remainingFarms = cluster.farms.filter((f) => !scheduled.has(f.id));
    if (remainingFarms.length === 0) continue;

    while (remainingFarms.length > 0) {
      const earliestWindow = remainingFarms
        .filter((f) => f.completionFrom)
        .map((f) => parseISO(f.completionFrom))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      if (earliestWindow && currentDate < earliestWindow) {
        currentDate = new Date(earliestWindow);
      }

      const ordered = optimizeRoute(remainingFarms, prefs);
      const tripDays = packIntoDays(ordered, prefs, currentDate, farmUnavailableDates);
      if (tripDays.length === 0) break;

      const scheduledInTrip = new Set<string>();
      for (const day of tripDays) {
        for (const insp of day.inspections) {
          scheduled.add(insp.farm.id);
          scheduledInTrip.add(insp.farm.id);
        }
      }

      // Determine trip type based on distance from home
      const tripFarms = remainingFarms.filter((f) => scheduledInTrip.has(f.id));
      const allNearHome = tripFarms.every(
        (f) => driveTimeBetween(prefs.homeLat, prefs.homeLng, f.lat, f.lng) <=
          (prefs.dayTripThresholdMinutes || 180)
      );
      const tripType: TripType = allNearHome ? "day_trip" : "multi_day";

      const trip = buildTrip(trips.length, tripDays, tripFarms, prefs, tripType);
      trips.push(trip);

      const lastTripDate = parseISO(tripDays[tripDays.length - 1].date);
      currentDate = addDays(lastTripDate, prefs.restDaysBetweenTrips + 1);
      remainingFarms = remainingFarms.filter((f) => !scheduledInTrip.has(f.id));
    }
  }

  return buildScheduleResult(trips, selectedFarms, deferredFarms, scheduled, certificationWarnings);
}

// ── Shared helpers for building trip and schedule objects ──
function buildTrip(
  index: number,
  tripDays: TripDay[],
  tripFarms: Farm[],
  prefs: InspectorPreferences,
  tripType: TripType,
  clusterId?: string
): Trip {
  const totalMiles = tripDays.reduce((s, d) => s + d.totalDriveMiles, 0);
  const driveFromHomeMiles = tripDays[0].driveFromHomeMiles;
  const driveToHomeMiles = tripDays[tripDays.length - 1].driveToHomeMiles;
  const fullTripMiles = totalMiles + driveFromHomeMiles + driveToHomeMiles;
  const overnights = tripDays.length > 1 ? tripDays.length - 1 : 0;

  const allNearHome = tripFarms.every(
    (f) => driveDistanceBetween(prefs.homeLat, prefs.homeLng, f.lat, f.lng) <= prefs.maxDayTripMiles
  );
  const actualOvernights = allNearHome ? 0 : overnights;

  const mileageCost = fullTripMiles * IRS_MILEAGE_RATE;
  const hotelCost = actualOvernights * HOTEL_NIGHTLY_RATE;

  return {
    id: `trip-${index + 1}`,
    tripNumber: index + 1,
    days: tripDays,
    totalFarms: tripDays.reduce((s, d) => s + d.inspections.length, 0),
    totalMiles: Math.round(fullTripMiles),
    startDate: tripDays[0].date,
    endDate: tripDays[tripDays.length - 1].date,
    estimatedTravelCost: Math.round(mileageCost + hotelCost),
    overnightsRequired: actualOvernights,
    tripType,
    clusterId,
  };
}

function buildScheduleResult(
  trips: Trip[],
  selectedFarms: Farm[],
  deferredFarms: Farm[],
  scheduled: Set<string>,
  certificationWarnings: string[]
): Schedule {
  const unscheduledFromSelected = selectedFarms.filter((f) => !scheduled.has(f.id));
  const unscheduled = [...unscheduledFromSelected, ...deferredFarms];
  const allDates = trips.flatMap((t) => t.days.map((d) => d.date));
  const totalEstimatedCost = trips.reduce((s, t) => s + t.estimatedTravelCost, 0);

  return {
    trips,
    unscheduled,
    skipped: [],
    totalFarms: scheduled.size,
    totalTrips: trips.length,
    dateRange: {
      start: allDates.length > 0 ? allDates[0] : "",
      end: allDates.length > 0 ? allDates[allDates.length - 1] : "",
    },
    totalEstimatedCost,
    certificationWarnings,
  };
}

// ── Stage 0: Certification check ──
function checkCertifications(
  farms: Farm[],
  prefs: InspectorPreferences
): string[] {
  const warnings: string[] = [];
  const certs = new Set(prefs.certifications.map((c) => c.toLowerCase()));

  for (const farm of farms) {
    const uncovered = farm.services.filter(
      (s) => !certs.has(s.toLowerCase())
    );
    if (uncovered.length > 0) {
      warnings.push(
        `${farm.name}: requires ${uncovered.join(", ")} (not in your certifications)`
      );
    }
  }
  return warnings;
}

// ── Stage 1: Score farm urgency ──
function scoreFarm(farm: Farm, referenceDate: Date): number {
  let score = 0;

  // Urgent priority bonus
  if (farm.priority === "urgent") score += 100;

  // Deadline proximity (tighter = higher)
  if (farm.completionUntil) {
    const deadline = parseISO(farm.completionUntil);
    const daysUntil = differenceInCalendarDays(deadline, referenceDate);
    score += Math.max(0, 50 - daysUntil);
  }

  // Window already open
  if (farm.completionFrom) {
    const windowStart = parseISO(farm.completionFrom);
    if (referenceDate >= windowStart) {
      score += 20;
    }
  }

  return score;
}

// ── Stage 2: K-means geographic clustering ──
export function kMeansCluster(farms: Farm[], k: number): Farm[][] {
  if (farms.length <= k) {
    return farms.map((f) => [f]);
  }

  // Initialize centroids by picking k evenly-spaced farms sorted by lat
  const sorted = [...farms].sort((a, b) => a.lat - b.lat);
  const step = Math.max(1, Math.floor(sorted.length / k));
  let centroids: { lat: number; lng: number }[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.min(i * step, sorted.length - 1);
    centroids.push({ lat: sorted[idx].lat, lng: sorted[idx].lng });
  }

  let assignments = new Array(farms.length).fill(0);
  const MAX_ITERATIONS = 20;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Assign each farm to nearest centroid
    const newAssignments = farms.map((farm) => {
      let nearest = 0;
      let nearestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dist = haversineDistance(
          farm.lat,
          farm.lng,
          centroids[c].lat,
          centroids[c].lng
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = c;
        }
      }
      return nearest;
    });

    // Check convergence
    const converged = newAssignments.every((a, i) => a === assignments[i]);
    assignments = newAssignments;
    if (converged) break;

    // Recompute centroids
    centroids = centroids.map((_, c) => {
      const members = farms.filter((_, i) => assignments[i] === c);
      if (members.length === 0) return centroids[c]; // keep old centroid
      return {
        lat: members.reduce((s, f) => s + f.lat, 0) / members.length,
        lng: members.reduce((s, f) => s + f.lng, 0) / members.length,
      };
    });
  }

  // Group farms by cluster
  const clusters: Farm[][] = Array.from({ length: k }, () => []);
  farms.forEach((farm, i) => {
    clusters[assignments[i]].push(farm);
  });

  // Remove empty clusters
  return clusters.filter((c) => c.length > 0);
}

export function centroid(farms: Farm[]): { lat: number; lng: number } {
  return {
    lat: farms.reduce((s, f) => s + f.lat, 0) / farms.length,
    lng: farms.reduce((s, f) => s + f.lng, 0) / farms.length,
  };
}

// ── Stage 3: Route optimization (nearest-neighbor + 2-opt) ──
function optimizeRoute(farms: Farm[], prefs: InspectorPreferences): Farm[] {
  if (farms.length <= 2) return farms;

  // Build initial order via nearest-neighbor from home
  let ordered: Farm[];
  if (prefs.tripStyle === "pinwheel") {
    // Angular sort from home
    ordered = [...farms].sort((a, b) => {
      const angleA = Math.atan2(
        a.lat - prefs.homeLat,
        a.lng - prefs.homeLng
      );
      const angleB = Math.atan2(
        b.lat - prefs.homeLat,
        b.lng - prefs.homeLng
      );
      return angleA - angleB;
    });
  } else {
    ordered = nearestNeighborOrder(farms, prefs.homeLat, prefs.homeLng);
  }

  if (ordered.length <= 3) return ordered;

  // 2-opt improvement
  const points = ordered.map((f) => ({ lat: f.lat, lng: f.lng }));
  const distMatrix = buildDistanceMatrix(points);

  let improved = true;
  let passes = 0;
  const maxPasses = 100;

  while (improved && passes < maxPasses) {
    improved = false;
    passes++;

    for (let i = 0; i < ordered.length - 1; i++) {
      for (let j = i + 2; j < ordered.length; j++) {
        const d1 = distMatrix[i][i + 1] + distMatrix[j][(j + 1) % ordered.length];
        const d2 = distMatrix[i][j] + distMatrix[i + 1][(j + 1) % ordered.length];

        if (d2 < d1 - 0.01) {
          // Reverse the segment between i+1 and j
          const segment = ordered.slice(i + 1, j + 1);
          segment.reverse();
          ordered.splice(i + 1, segment.length, ...segment);

          // Rebuild distance matrix for affected indices
          const newPoints = ordered.map((f) => ({ lat: f.lat, lng: f.lng }));
          const newMatrix = buildDistanceMatrix(newPoints);
          for (let x = 0; x < ordered.length; x++) {
            for (let y = 0; y < ordered.length; y++) {
              distMatrix[x][y] = newMatrix[x][y];
            }
          }

          improved = true;
        }
      }
    }
  }

  return ordered;
}

function nearestNeighborOrder(
  farms: Farm[],
  startLat: number,
  startLng: number
): Farm[] {
  const ordered: Farm[] = [];
  const remaining = [...farms];
  let curLat = startLat;
  let curLng = startLng;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(
        curLat,
        curLng,
        remaining[i].lat,
        remaining[i].lng
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    curLat = next.lat;
    curLng = next.lng;
  }

  return ordered;
}

// ── Stage 4: Day packing with proper time accounting ──
function packIntoDays(
  farms: Farm[],
  prefs: InspectorPreferences,
  startDate: Date,
  farmUnavailableDates?: Record<string, string[]>
): TripDay[] {
  const days: TripDay[] = [];
  let currentDate = skipToAvailableDay(new Date(startDate), prefs);
  let farmIdx = 0;
  let dayNumber = 1;
  const maxDays = prefs.preferredTripLengthDays;

  while (farmIdx < farms.length && days.length < maxDays) {
    currentDate = skipToAvailableDay(currentDate, prefs);

    const workMinutes = (prefs.workEndHour - prefs.workStartHour) * 60;
    const isFirstDayOfTrip = days.length === 0;

    // Determine starting position
    let prevLat: number, prevLng: number;
    if (isFirstDayOfTrip) {
      prevLat = prefs.homeLat;
      prevLng = prefs.homeLng;
    } else {
      const lastDay = days[days.length - 1];
      const lastInsp = lastDay.inspections[lastDay.inspections.length - 1];
      prevLat = lastInsp.farm.lat;
      prevLng = lastInsp.farm.lng;
    }

    // Calculate drive from home on first day
    let driveFromHomeMiles = 0;
    let driveFromHomeMinutes = 0;
    if (isFirstDayOfTrip) {
      const firstFarm = farms[farmIdx];
      driveFromHomeMiles = driveDistanceBetween(
        prefs.homeLat, prefs.homeLng,
        firstFarm.lat, firstFarm.lng
      );
      driveFromHomeMinutes = driveTimeBetween(
        prefs.homeLat, prefs.homeLng,
        firstFarm.lat, firstFarm.lng
      );
    }

    // Estimate return-to-home time for remaining farms to see if we need to reserve it
    // We'll calculate this after packing to adjust
    const dayInspections: ScheduledInspection[] = [];
    let minutesUsed = isFirstDayOfTrip ? driveFromHomeMinutes : 0;
    let dayMiles = isFirstDayOfTrip ? driveFromHomeMiles : 0;
    let dayDriveMinutes = isFirstDayOfTrip ? driveFromHomeMinutes : 0;
    let lunchTaken = false;
    let inspectionCount = 0;

    while (farmIdx < farms.length) {
      const farm = farms[farmIdx];

      // Check farm-specific unavailable dates
      const dateStr = format(currentDate, "yyyy-MM-dd");
      if (farmUnavailableDates?.[farm.id]?.includes(dateStr)) {
        farmIdx++;
        continue;
      }

      // Check completion window
      if (farm.completionFrom) {
        const windowStart = parseISO(farm.completionFrom);
        if (currentDate < windowStart) {
          // This farm's window hasn't opened — skip for now if there are farms after it
          // that could be scheduled today
          break;
        }
      }

      // Calculate drive to this farm
      const driveMiles = isFirstDayOfTrip && dayInspections.length === 0
        ? driveFromHomeMiles
        : driveDistanceBetween(prevLat, prevLng, farm.lat, farm.lng);
      const driveMinutes = isFirstDayOfTrip && dayInspections.length === 0
        ? driveFromHomeMinutes
        : driveTimeBetween(prevLat, prevLng, farm.lat, farm.lng);

      const inspectionMinutes = farm.estimatedDurationHours * 60;

      // Insert lunch break if needed (respects lunch preference)
      let lunchMinutes = 0;
      const wantsLunch = prefs.lunchPreference?.takeLunchBreak !== false;
      if (!lunchTaken && minutesUsed > 5 * 60 && wantsLunch) {
        lunchMinutes = prefs.lunchPreference?.lunchBreakMinutes || LUNCH_BREAK_MINUTES;
        lunchTaken = true;
      }

      const totalNeeded =
        (dayInspections.length === 0 ? 0 : driveMinutes) +
        lunchMinutes +
        inspectionMinutes;

      // Check if we'd exceed work hours
      if (minutesUsed + totalNeeded > workMinutes && dayInspections.length > 0) {
        break;
      }

      // Check daily mile limit (cumulative)
      const addedMiles = dayInspections.length === 0 ? 0 : driveMiles;
      if (
        dayMiles + addedMiles > prefs.maxDailyDriveMiles &&
        dayInspections.length > 0
      ) {
        break;
      }

      // Check max daily inspections
      if (inspectionCount >= prefs.maxDailyInspections) {
        break;
      }

      // Schedule this inspection
      if (lunchMinutes > 0) {
        minutesUsed += lunchMinutes;
      }

      const driveForThisInsp =
        dayInspections.length === 0 ? 0 : driveMinutes;
      minutesUsed += driveForThisInsp;

      const startMinute =
        prefs.workStartHour * 60 + minutesUsed;
      const startHour = Math.floor(startMinute / 60);
      const startMin = Math.round(startMinute % 60);

      minutesUsed += inspectionMinutes;

      const endMinute = startMinute + inspectionMinutes;
      const endHour = Math.floor(endMinute / 60);
      const endMin = Math.round(endMinute % 60);

      dayInspections.push({
        farm,
        date: format(currentDate, "yyyy-MM-dd"),
        startTime: `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`,
        endTime: `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`,
        driveTimeFromPrevMinutes: Math.round(
          dayInspections.length === 0 && isFirstDayOfTrip
            ? driveFromHomeMinutes
            : driveMinutes
        ),
        driveDistanceFromPrevMiles: Math.round(
          dayInspections.length === 0 && isFirstDayOfTrip
            ? driveFromHomeMiles
            : driveMiles
        ),
        contactStatus: "not_contacted",
      });

      if (dayInspections.length > 1) {
        dayMiles += driveMiles;
        dayDriveMinutes += driveMinutes;
      }

      inspectionCount++;
      prevLat = farm.lat;
      prevLng = farm.lng;
      farmIdx++;
    }

    if (dayInspections.length > 0) {
      // Calculate return to home distance (for last day annotation)
      const lastFarm =
        dayInspections[dayInspections.length - 1].farm;
      const driveToHomeMiles = driveDistanceBetween(
        lastFarm.lat,
        lastFarm.lng,
        prefs.homeLat,
        prefs.homeLng
      );
      const driveToHomeMinutes = driveTimeBetween(
        lastFarm.lat,
        lastFarm.lng,
        prefs.homeLat,
        prefs.homeLng
      );

      days.push({
        date: format(currentDate, "yyyy-MM-dd"),
        dayLabel: `Day ${dayNumber}`,
        inspections: dayInspections,
        totalDriveMiles: Math.round(dayMiles),
        totalDriveMinutes: Math.round(dayDriveMinutes),
        totalInspectionHours: dayInspections.reduce(
          (sum, i) => sum + i.farm.estimatedDurationHours,
          0
        ),
        driveFromHomeMiles: isFirstDayOfTrip
          ? Math.round(driveFromHomeMiles)
          : 0,
        driveFromHomeMinutes: isFirstDayOfTrip
          ? Math.round(driveFromHomeMinutes)
          : 0,
        driveToHomeMiles: Math.round(driveToHomeMiles),
        driveToHomeMinutes: Math.round(driveToHomeMinutes),
      });
      dayNumber++;
    }

    currentDate = addDays(currentDate, 1);

    // Safety: prevent infinite loops
    if (dayNumber > 60) break;
  }

  return days;
}

function skipToAvailableDay(
  date: Date,
  prefs: InspectorPreferences
): Date {
  let d = new Date(date);
  let safety = 0;
  while (safety < 30) {
    const dayName = DAY_NAMES[getDay(d)];
    if (prefs.availableDays.includes(dayName)) return d;
    d = addDays(d, 1);
    safety++;
  }
  return d;
}

function emptySchedule(): Schedule {
  return {
    trips: [],
    unscheduled: [],
    skipped: [],
    totalFarms: 0,
    totalTrips: 0,
    dateRange: { start: "", end: "" },
    totalEstimatedCost: 0,
    certificationWarnings: [],
  };
}

// ── Export schedule as CSV ──
export function scheduleToCSV(schedule: Schedule, prefs?: InspectorPreferences): string {
  const headers = [
    "Trip",
    "Trip Type",
    "Day",
    "Date",
    "Start Time",
    "End Time",
    "Name",
    "NOP ID",
    "Audit No.",
    "Address",
    "City",
    "State",
    "ZIP",
    "Email",
    "Phone",
    "Priority",
    "Services",
    "Audit Type",
    "Duration (hrs)",
    "Drive Time (min)",
    "Drive Distance (mi)",
    "Completion From",
    "Completion Until",
    "Unannounced",
    "Sampling Required",
    "Contact Status",
    "Notes",
    "Trip Total Miles",
    "Trip Overnights",
    "Est. Trip Cost",
    "Email Subject",
    "Email Body",
    "Call Script",
  ];

  const rows: string[][] = [];
  for (const trip of schedule.trips) {
    let isFirstInspOfTrip = true;
    for (const day of trip.days) {
      for (const insp of day.inspections) {
        const f = insp.farm;

        // Generate contact script if prefs are available
        let emailSubject = "";
        let emailBody = "";
        let callScript = "";
        if (prefs) {
          const script = generateContactScript(insp, prefs);
          if (script) {
            emailSubject = script.emailSubject;
            emailBody = script.emailBody;
            callScript = script.callScript;
          }
        }

        rows.push([
          `Trip ${trip.tripNumber}`,
          trip.tripType === "multi_day" ? "Travel" : "Day Trip",
          day.dayLabel,
          insp.date,
          insp.startTime,
          insp.endTime,
          csvEscape(f.name),
          f.nopId,
          f.auditNumber,
          csvEscape(f.address),
          f.city,
          f.state,
          f.zip,
          f.email,
          f.phone,
          f.priority === "urgent" ? "Urgent" : "Normal",
          csvEscape(f.services.join("; ")),
          csvEscape(f.auditType),
          String(f.estimatedDurationHours),
          String(insp.driveTimeFromPrevMinutes),
          String(insp.driveDistanceFromPrevMiles),
          f.completionFrom,
          f.completionUntil,
          f.unannounced ? "Yes" : "No",
          f.samplingRequired ? "Yes" : "No",
          insp.contactStatus,
          csvEscape(f.notes),
          // Only show trip-level stats on the first inspection of the trip
          isFirstInspOfTrip ? String(trip.totalMiles) : "",
          isFirstInspOfTrip ? String(trip.overnightsRequired) : "",
          isFirstInspOfTrip ? `$${trip.estimatedTravelCost}` : "",
          csvEscape(emailSubject),
          csvEscape(emailBody),
          csvEscape(callScript),
        ]);

        isFirstInspOfTrip = false;
      }
    }
  }

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function csvEscape(value: string): string {
  if (!value) return "";
  // Wrap in quotes if the value contains commas, quotes, or newlines
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
