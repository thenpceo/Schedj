import { useState, useEffect, useRef, useTransition } from "react";
import { Farm, InspectorPreferences, Schedule, TripPlan } from "@/lib/types";
import { generateSchedule, generateTravelTripsOnly } from "@/lib/scheduler";

const DEBOUNCE_MS = 300;

export type SchedulerMode = "full" | "travel_only";

/**
 * Custom hook that runs the scheduler with debouncing and React transitions.
 * mode="travel_only" generates only travel trips (Phase A).
 * mode="full" generates the complete schedule (Phase B or legacy).
 */
export function useScheduler(
  farms: Farm[],
  prefs: InspectorPreferences | null,
  tripPlans?: TripPlan[],
  farmUnavailableDates?: Record<string, string[]>,
  mode: SchedulerMode = "full"
): { schedule: Schedule | null; isComputing: boolean } {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!prefs || farms.length === 0) {
      setSchedule(null);
      return;
    }

    // Clear previous debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      startTransition(() => {
        const result =
          mode === "travel_only"
            ? generateTravelTripsOnly(farms, prefs, farmUnavailableDates)
            : generateSchedule(farms, prefs, tripPlans, farmUnavailableDates);
        setSchedule(result);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [farms, prefs, tripPlans, farmUnavailableDates, mode]);

  return { schedule, isComputing: isPending };
}
