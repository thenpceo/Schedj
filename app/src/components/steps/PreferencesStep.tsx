"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Clock,
  Car,
  CalendarDays,
  MapPin,
  Bed,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Farm, TravelPrefs } from "@/lib/types";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_TRAVEL_PREFS: TravelPrefs = {
  maxDaysAway: 4,
  maxDrivingDistanceMiles: 300,
  inspectionsPerDay: 3,
  maxLocalDrivingRadiusMiles: 75,
  workStartHour: 8,
  workEndHour: 17,
  availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

const PREFS_STORAGE_KEY = "schedj-travel-prefs";
const PREFS_VERSION = 2;

function loadTravelPrefs(): TravelPrefs {
  if (typeof window === "undefined") return DEFAULT_TRAVEL_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_TRAVEL_PREFS;
    const parsed = JSON.parse(raw);
    if (parsed.version !== PREFS_VERSION) return DEFAULT_TRAVEL_PREFS;
    const { version: _, ...saved } = parsed;
    return { ...DEFAULT_TRAVEL_PREFS, ...saved };
  } catch {
    return DEFAULT_TRAVEL_PREFS;
  }
}

interface PreferencesStepProps {
  farms: Farm[];
  isGeocodingComplete: boolean;
  geocodingProgress?: { completed: number; total: number };
  onGenerateSchedule: (travelPrefs: TravelPrefs) => void;
}

export default function PreferencesStep({
  farms,
  isGeocodingComplete,
  geocodingProgress,
  onGenerateSchedule,
}: PreferencesStepProps) {
  const [prefs, setPrefs] = useState<TravelPrefs>(loadTravelPrefs);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({ version: PREFS_VERSION, ...prefs })
      );
    } catch {
      // Silently fail
    }
  }, [prefs]);

  const update = useCallback((patch: Partial<TravelPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleDay = useCallback((day: string) => {
    setPrefs((prev) => {
      const days = prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];
      return { ...prev, availableDays: days };
    });
  }, []);

  const handleGenerate = useCallback(() => {
    onGenerateSchedule(prefs);
  }, [prefs, onGenerateSchedule]);

  const geocodedCount = farms.filter((f) => f.lat !== 0 || f.lng !== 0).length;
  const needsLocationCount = farms.filter((f) => f.lat === 0 && f.lng === 0).length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Geocoding progress (non-blocking) */}
      {!isGeocodingComplete && geocodingProgress && (
        <div className="mb-6 p-4 bg-primary-50 rounded-[var(--radius-lg)] border border-primary-100">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
            <span className="text-sm font-medium text-primary-700">
              Geocoding addresses in background...
            </span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-primary-500" />
            <div className="flex-1">
              <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{
                    width: geocodingProgress.total > 0
                      ? `${(geocodingProgress.completed / geocodingProgress.total) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
            <span className="text-xs text-primary-600 tabular-nums">
              {geocodingProgress.completed}/{geocodingProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* Farm summary */}
      <div className="mb-6 p-4 bg-earth-50 rounded-[var(--radius-lg)] border border-earth-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-earth-700">
            {farms.length} farms loaded
          </span>
          <div className="flex items-center gap-3 text-xs text-earth-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary-500" />
              {geocodedCount} located
            </span>
            {needsLocationCount > 0 && (
              <span className="text-amber-600">
                {needsLocationCount} need location
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Travel Preferences Form */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-primary-800 flex items-center gap-2">
          <Car className="w-5 h-5 text-primary-600" />
          Travel Preferences
        </h2>

        {/* Max days away */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-earth-700 flex items-center gap-2">
            <Bed className="w-4 h-4 text-primary-500" />
            Max days away per trip
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={7}
              value={prefs.maxDaysAway}
              onChange={(e) => update({ maxDaysAway: Number(e.target.value) })}
              className="flex-1 accent-primary-600"
            />
            <span className="w-12 text-center text-sm font-semibold text-primary-700 bg-primary-50 rounded-md py-1">
              {prefs.maxDaysAway}
            </span>
          </div>
        </div>

        {/* Max driving distance */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-earth-700 flex items-center gap-2">
            <Car className="w-4 h-4 text-primary-500" />
            Max one-way driving distance (miles)
          </label>
          <div className="relative">
            <select
              value={prefs.maxDrivingDistanceMiles}
              onChange={(e) => update({ maxDrivingDistanceMiles: Number(e.target.value) })}
              className="w-full appearance-none bg-white border border-earth-200 rounded-[var(--radius-md)] px-4 py-2.5 pr-10 text-sm text-earth-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            >
              {[100, 150, 200, 250, 300, 400, 500].map((d) => (
                <option key={d} value={d}>{d} miles</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400 pointer-events-none" />
          </div>
          <p className="text-xs text-earth-400">Beyond this distance, consider flying</p>
        </div>

        {/* Inspections per day */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-earth-700 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary-500" />
            Inspections per day (target)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={6}
              value={prefs.inspectionsPerDay}
              onChange={(e) => update({ inspectionsPerDay: Number(e.target.value) })}
              className="flex-1 accent-primary-600"
            />
            <span className="w-12 text-center text-sm font-semibold text-primary-700 bg-primary-50 rounded-md py-1">
              {prefs.inspectionsPerDay}
            </span>
          </div>
        </div>

        {/* Max local driving radius */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-earth-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-500" />
            Max local driving radius (miles)
          </label>
          <div className="relative">
            <select
              value={prefs.maxLocalDrivingRadiusMiles}
              onChange={(e) => update({ maxLocalDrivingRadiusMiles: Number(e.target.value) })}
              className="w-full appearance-none bg-white border border-earth-200 rounded-[var(--radius-md)] px-4 py-2.5 pr-10 text-sm text-earth-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            >
              {[25, 50, 75, 100, 150].map((d) => (
                <option key={d} value={d}>{d} miles</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400 pointer-events-none" />
          </div>
          <p className="text-xs text-earth-400">From hotel base during travel trips</p>
        </div>

        {/* Work hours */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-earth-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-500" />
            Work hours
          </label>
          <div className="flex items-center gap-2">
            <select
              value={prefs.workStartHour}
              onChange={(e) => update({ workStartHour: Number(e.target.value) })}
              className="flex-1 appearance-none bg-white border border-earth-200 rounded-[var(--radius-md)] px-3 py-2 text-sm text-earth-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {Array.from({ length: 12 }, (_, i) => i + 5).map((h) => (
                <option key={h} value={h}>
                  {h === 12 ? "12:00 PM" : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
                </option>
              ))}
            </select>
            <span className="text-earth-400 text-sm">to</span>
            <select
              value={prefs.workEndHour}
              onChange={(e) => update({ workEndHour: Number(e.target.value) })}
              className="flex-1 appearance-none bg-white border border-earth-200 rounded-[var(--radius-md)] px-3 py-2 text-sm text-earth-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => (
                <option key={h} value={h}>
                  {h === 12 ? "12:00 PM" : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Available days */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-earth-700">Available days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const active = prefs.availableDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    active
                      ? "bg-primary-100 text-primary-700 ring-1 ring-primary-300"
                      : "bg-earth-100 text-earth-400 hover:bg-earth-150"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <div className="mt-10">
        <button
          onClick={handleGenerate}
          disabled={!isGeocodingComplete || geocodedCount === 0}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-[var(--radius-lg)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!isGeocodingComplete
            ? "Waiting for location data..."
            : "Generate Schedule"}
        </button>
        {!isGeocodingComplete && (
          <p className="text-xs text-earth-400 text-center mt-2">
            Set your preferences while we geocode farm addresses
          </p>
        )}
      </div>
    </div>
  );
}
