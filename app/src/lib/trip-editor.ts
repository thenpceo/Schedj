import {
  TripV3,
  TripDay,
  Farm,
  WindowViolation,
  IRS_MILEAGE_RATE,
  HOTEL_NIGHTLY_RATE,
} from "./types";
import { driveTimeBetween, driveDistanceBetween } from "./geo";

// ── Split a trip after a given day index ──

export function splitTrip(
  trip: TripV3,
  afterDay: number
): [TripV3, TripV3] | null {
  if (afterDay < 0 || afterDay >= trip.days.length - 1) return null;

  const daysA = trip.days.slice(0, afterDay + 1);
  const daysB = trip.days.slice(afterDay + 1);

  if (daysA.length === 0 || daysB.length === 0) return null;

  const tripA = rebuildTrip({
    ...trip,
    id: `${trip.id}-a`,
    days: daysA,
  });

  const tripB = rebuildTrip({
    ...trip,
    id: `${trip.id}-b`,
    tripNumber: trip.tripNumber + 1,
    days: daysB,
  });

  return [tripA, tripB];
}

// ── Merge two trips into one ──

export function mergeTrips(tripA: TripV3, tripB: TripV3): TripV3 {
  const allDays = [...tripA.days, ...tripB.days].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Renumber day labels
  const renumbered = allDays.map((d, i) => ({
    ...d,
    dayLabel: `Day ${i + 1}`,
  }));

  return rebuildTrip({
    ...tripA,
    id: `${tripA.id}+${tripB.id}`,
    days: renumbered,
    isUserEdited: true,
  });
}

// ── Move farms from one trip to another ──

export function moveFarms(
  fromTrip: TripV3,
  toTrip: TripV3,
  farmIds: Set<string>
): { from: TripV3; to: TripV3 } {
  // Extract farms to move
  const movedFarms: Farm[] = [];
  const fromDays: TripDay[] = fromTrip.days.map((day) => {
    const kept = day.inspections.filter((insp) => {
      if (farmIds.has(insp.farm.id)) {
        movedFarms.push(insp.farm);
        return false;
      }
      return true;
    });
    return { ...day, inspections: kept };
  }).filter((day) => day.inspections.length > 0); // Remove empty days

  // Add moved farms to the last day of destination trip (or create one)
  let toDays = [...toTrip.days];
  if (toDays.length === 0) {
    toDays = [{
      date: fromTrip.startDate,
      dayLabel: "Day 1",
      inspections: [],
      totalDriveMiles: 0,
      totalDriveMinutes: 0,
      totalInspectionHours: 0,
      driveFromHomeMiles: 0,
      driveFromHomeMinutes: 0,
      driveToHomeMiles: 0,
      driveToHomeMinutes: 0,
    }];
  }

  const lastDay = { ...toDays[toDays.length - 1] };
  lastDay.inspections = [
    ...lastDay.inspections,
    ...movedFarms.map((farm) => ({
      farm,
      date: lastDay.date,
      startTime: "09:00",
      endTime: `${9 + farm.estimatedDurationHours}:00`,
      driveTimeFromPrevMinutes: 0,
      driveDistanceFromPrevMiles: 0,
      contactStatus: "not_contacted" as const,
    })),
  ];
  toDays[toDays.length - 1] = lastDay;

  return {
    from: rebuildTrip({ ...fromTrip, days: fromDays, isUserEdited: true }),
    to: rebuildTrip({ ...toTrip, days: toDays, isUserEdited: true }),
  };
}

// ── Reorder farms within a trip ──

export function reorderFarms(
  trip: TripV3,
  dayIndex: number,
  newOrder: string[] // farm IDs in desired order
): TripV3 {
  if (dayIndex < 0 || dayIndex >= trip.days.length) return trip;

  const day = trip.days[dayIndex];
  const inspectionMap = new Map(
    day.inspections.map((insp) => [insp.farm.id, insp])
  );

  const reordered = newOrder
    .map((id) => inspectionMap.get(id))
    .filter(Boolean) as typeof day.inspections;

  // Add any inspections not in newOrder at the end
  for (const insp of day.inspections) {
    if (!newOrder.includes(insp.farm.id)) {
      reordered.push(insp);
    }
  }

  const newDays = [...trip.days];
  newDays[dayIndex] = { ...day, inspections: reordered };

  return rebuildTrip({ ...trip, days: newDays, isUserEdited: true });
}

// ── Create a new trip from selected farms ──

export function createTripFromFarms(
  farms: Farm[],
  tripId: string,
  tripNumber: number,
  startDate: string
): TripV3 {
  const inspections = farms.map((farm) => ({
    farm,
    date: startDate,
    startTime: "09:00",
    endTime: `${9 + farm.estimatedDurationHours}:00`,
    driveTimeFromPrevMinutes: 0,
    driveDistanceFromPrevMiles: 0,
    contactStatus: "not_contacted" as const,
  }));

  return rebuildTrip({
    id: tripId,
    tripNumber,
    days: [{
      date: startDate,
      dayLabel: "Day 1",
      inspections,
      totalDriveMiles: 0,
      totalDriveMinutes: 0,
      totalInspectionHours: 0,
      driveFromHomeMiles: 0,
      driveFromHomeMinutes: 0,
      driveToHomeMiles: 0,
      driveToHomeMinutes: 0,
    }],
    totalFarms: farms.length,
    totalMiles: 0,
    startDate,
    endDate: startDate,
    estimatedTravelCost: 0,
    overnightsRequired: 0,
    tripType: "day_trip",
    hotelSuggestion: undefined,
    windowViolations: [],
    isUserEdited: true,
  });
}

// ── Validate completion windows for all farms in a trip ──

export function validateWindowViolations(trip: TripV3): WindowViolation[] {
  const violations: WindowViolation[] = [];

  for (const day of trip.days) {
    for (const insp of day.inspections) {
      const farm = insp.farm;

      if (farm.completionFrom && trip.startDate < farm.completionFrom) {
        violations.push({
          farmId: farm.id,
          farmName: farm.name,
          reason: `Trip starts ${trip.startDate} before inspection window opens ${farm.completionFrom}`,
          completionFrom: farm.completionFrom,
          tripStartDate: trip.startDate,
        });
      }

      if (farm.completionUntil && trip.endDate > farm.completionUntil) {
        violations.push({
          farmId: farm.id,
          farmName: farm.name,
          reason: `Trip ends ${trip.endDate} after inspection window closes ${farm.completionUntil}`,
          completionUntil: farm.completionUntil,
          tripEndDate: trip.endDate,
        });
      }
    }
  }

  return violations;
}

// ── Compute impact preview for moving farms ──

export interface MoveImpact {
  addedMiles: number;
  addedDays: number;
  windowViolations: number;
}

export function computeMoveImpact(
  farms: Farm[],
  targetTrip: TripV3
): MoveImpact {
  const totalHours = farms.reduce(
    (sum, f) => sum + f.estimatedDurationHours,
    0
  );
  const addedDays = Math.ceil(totalHours / 8);

  // Estimate additional miles from trip centroid to new farms
  const existingFarms = targetTrip.days.flatMap((d) =>
    d.inspections.map((i) => i.farm)
  );
  let addedMiles = 0;
  if (existingFarms.length > 0) {
    const lastFarm = existingFarms[existingFarms.length - 1];
    for (const farm of farms) {
      addedMiles += driveDistanceBetween(
        lastFarm.lat, lastFarm.lng,
        farm.lat, farm.lng
      );
    }
  }

  return {
    addedMiles: Math.round(addedMiles),
    addedDays,
    windowViolations: 0, // computed after actual move
  };
}

// ── Internal: rebuild trip aggregates ──

function rebuildTrip(partial: TripV3): TripV3 {
  const days = partial.days;
  const totalFarms = days.reduce((s, d) => s + d.inspections.length, 0);
  const totalMiles = days.reduce((s, d) => s + d.totalDriveMiles, 0);
  const startDate = days[0]?.date || partial.startDate;
  const endDate = days[days.length - 1]?.date || partial.endDate;
  const overnights = Math.max(0, days.length - 1);
  const mileageCost = totalMiles * IRS_MILEAGE_RATE;
  const hotelCost = overnights * HOTEL_NIGHTLY_RATE;

  const trip: TripV3 = {
    ...partial,
    totalFarms,
    totalMiles: Math.round(totalMiles),
    startDate,
    endDate,
    overnightsRequired: overnights,
    estimatedTravelCost: Math.round(mileageCost + hotelCost),
    tripType: overnights > 0 ? "multi_day" : "day_trip",
    windowViolations: [],
    isUserEdited: partial.isUserEdited ?? false,
  };

  // Revalidate completion windows
  trip.windowViolations = validateWindowViolations(trip);

  return trip;
}
