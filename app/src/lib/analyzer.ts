import {
  Farm,
  InspectorPreferences,
  FarmCluster,
  RegionAnalysis,
  TripType,
  DEFAULT_DAY_TRIP_THRESHOLD_MINUTES,
} from "./types";
import { driveTimeBetween, driveDistanceBetween } from "./geo";
import { kMeansCluster, centroid } from "./scheduler";

/**
 * Analyze uploaded farms and classify them into geographic clusters,
 * distinguishing day-trip-reachable farms from multi-day travel clusters.
 */
export function analyzeRegions(
  farms: Farm[],
  prefs: InspectorPreferences
): RegionAnalysis {
  const threshold = prefs.dayTripThresholdMinutes || DEFAULT_DAY_TRIP_THRESHOLD_MINUTES;
  const warnings: string[] = [];

  // Filter out do_not_inspect
  const inspectable = farms.filter((f) => f.priority !== "do_not_inspect");
  if (inspectable.length === 0) {
    return {
      clusters: [],
      dayTripFarms: [],
      multiDayFarms: [],
      totalFarms: 0,
      urgentFarms: [],
      warnings: ["No inspectable farms found."],
    };
  }

  // Classify each farm as day-trip or multi-day based on drive time from home
  const dayTripFarms: Farm[] = [];
  const multiDayFarms: Farm[] = [];

  for (const farm of inspectable) {
    const driveMinutes = driveTimeBetween(
      prefs.homeLat, prefs.homeLng,
      farm.lat, farm.lng
    );
    if (driveMinutes <= threshold) {
      dayTripFarms.push(farm);
    } else {
      multiDayFarms.push(farm);
    }
  }

  // Cluster multi-day farms geographically
  const multiDayClusters = clusterAndLabel(multiDayFarms, prefs, "multi_day", threshold);

  // Group day-trip farms into a single cluster (or a few if spread out)
  const dayTripClusters = dayTripFarms.length > 0
    ? clusterAndLabel(dayTripFarms, prefs, "day_trip", threshold)
    : [];

  const allClusters = [...multiDayClusters, ...dayTripClusters];

  // Sort: urgent clusters first, then by distance
  allClusters.sort((a, b) => {
    if (a.urgentCount !== b.urgentCount) return b.urgentCount - a.urgentCount;
    return a.driveTimeFromHomeMinutes - b.driveTimeFromHomeMinutes;
  });

  const urgentFarms = inspectable.filter((f) => f.priority === "urgent");

  if (urgentFarms.length > 0) {
    warnings.push(
      `${urgentFarms.length} urgent farm(s) need priority scheduling.`
    );
  }

  return {
    clusters: allClusters,
    dayTripFarms,
    multiDayFarms,
    totalFarms: inspectable.length,
    urgentFarms,
    warnings,
  };
}

function clusterAndLabel(
  farms: Farm[],
  prefs: InspectorPreferences,
  tripType: TripType,
  threshold: number
): FarmCluster[] {
  if (farms.length === 0) return [];

  // Determine number of clusters
  const avgDuration = farms.reduce((s, f) => s + f.estimatedDurationHours, 0) / farms.length;
  const workHours = prefs.workEndHour - prefs.workStartHour;
  const farmsPerDay = Math.max(1, Math.floor(workHours / avgDuration));
  const tripDays = tripType === "day_trip" ? 1 : prefs.preferredTripLengthDays;
  const farmsPerTrip = farmsPerDay * tripDays;
  const k = Math.max(1, Math.ceil(farms.length / Math.max(1, farmsPerTrip)));

  const rawClusters = kMeansCluster(farms, k);

  return rawClusters.map((clusterFarms, i) => {
    const center = centroid(clusterFarms) ?? { lat: prefs.homeLat, lng: prefs.homeLng };
    const driveMinutes = driveTimeBetween(
      prefs.homeLat, prefs.homeLng,
      center.lat, center.lng
    );
    const driveMiles = driveDistanceBetween(
      prefs.homeLat, prefs.homeLng,
      center.lat, center.lng
    );

    const urgentCount = clusterFarms.filter((f) => f.priority === "urgent").length;
    const totalHours = clusterFarms.reduce((s, f) => s + f.estimatedDurationHours, 0);
    const suggestedDays = Math.max(1, Math.ceil(totalHours / workHours));

    // Completion windows
    const froms = clusterFarms
      .map((f) => f.completionFrom)
      .filter(Boolean)
      .sort();
    const untils = clusterFarms
      .map((f) => f.completionUntil)
      .filter(Boolean)
      .sort();

    const label = generateClusterLabel(clusterFarms, center);

    // Determine effective trip type per cluster
    const effectiveTripType: TripType = driveMinutes <= threshold ? "day_trip" : "multi_day";

    return {
      id: `cluster-${i + 1}`,
      label,
      farms: clusterFarms,
      centroid: center,
      avgDistanceFromHomeMiles: Math.round(driveMiles),
      driveTimeFromHomeMinutes: Math.round(driveMinutes),
      tripType: effectiveTripType,
      urgentCount,
      totalEstimatedHours: Math.round(totalHours * 10) / 10,
      suggestedTripDays: suggestedDays,
      completionWindows: {
        earliest: froms[0] || "",
        latest: untils[untils.length - 1] || "",
      },
    };
  });
}

function generateClusterLabel(
  farms: Farm[],
  center: { lat: number; lng: number }
): string {
  // Use most common state + most common municipality/city
  const states = farms.map((f) => f.state).filter(Boolean);
  const stateCount: Record<string, number> = {};
  for (const s of states) {
    stateCount[s] = (stateCount[s] || 0) + 1;
  }
  const topState = Object.entries(stateCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  // Use most common city for more specificity
  const cities = farms.map((f) => f.city).filter(Boolean);
  const cityCount: Record<string, number> = {};
  for (const c of cities) {
    cityCount[c] = (cityCount[c] || 0) + 1;
  }
  const sortedCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]);

  if (farms.length <= 2 && sortedCities.length > 0) {
    // Small cluster — just list the cities
    return sortedCities.map(([city]) => city).join(" & ") + (topState ? `, ${topState}` : "");
  }

  // Use direction from center of state
  const topCity = sortedCities[0]?.[0];
  if (topCity && topState) {
    return `${topCity} area, ${topState}`;
  }

  if (topState) {
    const latDir = center.lat > 40 ? "Northern" : center.lat < 38 ? "Southern" : "Central";
    return `${latDir} ${topState}`;
  }

  return `Region ${farms.length} farms`;
}
