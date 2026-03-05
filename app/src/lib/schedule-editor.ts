import {
  Schedule,
  InspectorPreferences,
  TripPlan,
  ScheduleEdit,
} from "./types";
import { generateSchedule } from "./scheduler";

/**
 * Apply a schedule edit by updating farm unavailable dates,
 * then optionally re-running the scheduler with those constraints.
 */
export function applyEdit(
  edit: ScheduleEdit,
  currentUnavailableDates: Record<string, string[]>
): Record<string, string[]> {
  const updated = { ...currentUnavailableDates };

  switch (edit.type) {
    case "mark_unavailable": {
      const existing = updated[edit.inspectionFarmId] || [];
      const newDates = edit.unavailableDates || [];
      updated[edit.inspectionFarmId] = [...new Set([...existing, ...newDates])];
      break;
    }
    case "change_date": {
      // Mark the old date as unavailable so re-optimization avoids it
      if (edit.fromDate) {
        const existing = updated[edit.inspectionFarmId] || [];
        updated[edit.inspectionFarmId] = [...new Set([...existing, edit.fromDate])];
      }
      break;
    }
    case "remove_inspection": {
      // Mark all dates as unavailable (effectively removes from schedule)
      // The farm will appear in unscheduled list
      const existing = updated[edit.inspectionFarmId] || [];
      updated[edit.inspectionFarmId] = [...existing, "__removed__"];
      break;
    }
    case "move_inspection": {
      // Mark old date unavailable, new date preferred (handled by re-optimization)
      if (edit.fromDate) {
        const existing = updated[edit.inspectionFarmId] || [];
        updated[edit.inspectionFarmId] = [...new Set([...existing, edit.fromDate])];
      }
      break;
    }
  }

  return updated;
}

/**
 * Re-run the scheduler with updated constraints (unavailable dates, etc.)
 */
export function reoptimizeSchedule(
  farms: import("./types").Farm[],
  prefs: InspectorPreferences,
  tripPlans?: TripPlan[],
  farmUnavailableDates?: Record<string, string[]>
): Schedule {
  // Filter out farms marked as "__removed__"
  const activeFarms = farms.filter((f) => {
    const unavailable = farmUnavailableDates?.[f.id];
    return !unavailable?.includes("__removed__");
  });

  // Clean up unavailable dates (remove __removed__ marker for the scheduler)
  const cleanDates: Record<string, string[]> = {};
  if (farmUnavailableDates) {
    for (const [farmId, dates] of Object.entries(farmUnavailableDates)) {
      const realDates = dates.filter((d) => d !== "__removed__");
      if (realDates.length > 0) {
        cleanDates[farmId] = realDates;
      }
    }
  }

  return generateSchedule(activeFarms, prefs, tripPlans, cleanDates);
}
