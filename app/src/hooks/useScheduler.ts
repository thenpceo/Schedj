import { useState, useEffect, useRef, useTransition } from "react";
import { Farm, InspectorPreferences, Schedule, TripPlan } from "@/lib/types";
import { generateSchedule } from "@/lib/scheduler";

const DEBOUNCE_MS = 300;

/**
 * Custom hook that runs the scheduler with debouncing and React transitions.
 * Returns the current schedule and a computing indicator.
 */
export function useScheduler(
  farms: Farm[],
  prefs: InspectorPreferences | null,
  tripPlans?: TripPlan[],
  farmUnavailableDates?: Record<string, string[]>
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
        const result = generateSchedule(farms, prefs, tripPlans, farmUnavailableDates);
        setSchedule(result);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [farms, prefs, tripPlans, farmUnavailableDates]);

  return { schedule, isComputing: isPending };
}
