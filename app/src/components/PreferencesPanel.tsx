"use client";

import { useState } from "react";
import {
  Car,
  Plane,
  Clock,
  UtensilsCrossed,
  SlidersHorizontal,
  Calendar,
} from "lucide-react";
import { InspectorPreferences } from "@/lib/types";

interface PreferencesPanelProps {
  prefs: InspectorPreferences;
  onChange: (prefs: InspectorPreferences) => void;
  isComputing?: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Tab = "day" | "travel" | "general";

export default function PreferencesPanel({
  prefs,
  onChange,
  isComputing,
}: PreferencesPanelProps) {
  const [tab, setTab] = useState<Tab>("day");

  const update = (patch: Partial<InspectorPreferences>) => {
    onChange({ ...prefs, ...patch });
  };

  const inputClasses =
    "w-full px-3 py-2 bg-white border border-earth-200 rounded-[var(--radius-md)] focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 text-primary-800 font-medium text-sm transition-all duration-200";

  return (
    <div className="bg-white border border-earth-200 rounded-[var(--radius-xl)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-earth-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary-500" />
          <h3 className="font-[family-name:var(--font-display)] font-semibold text-primary-800 text-sm">
            Preferences
          </h3>
        </div>
        {isComputing && (
          <span className="text-[11px] text-primary-500 font-medium animate-pulse">
            Updating...
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-earth-100">
        {([
          { key: "day" as Tab, label: "Day Trips", icon: Car },
          { key: "travel" as Tab, label: "Travel", icon: Plane },
          { key: "general" as Tab, label: "General", icon: Clock },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              tab === key
                ? "text-primary-700 border-b-2 border-primary-500 bg-primary-50/30"
                : "text-primary-600/40 hover:text-primary-600/60"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 space-y-4">
        {tab === "day" && (
          <DayTripTab prefs={prefs} update={update} inputClasses={inputClasses} />
        )}
        {tab === "travel" && (
          <TravelTripTab prefs={prefs} update={update} inputClasses={inputClasses} />
        )}
        {tab === "general" && (
          <GeneralTab prefs={prefs} update={update} inputClasses={inputClasses} />
        )}
      </div>
    </div>
  );
}

/* ── Day Trip Tab ── */
function DayTripTab({
  prefs,
  update,
  inputClasses,
}: {
  prefs: InspectorPreferences;
  update: (patch: Partial<InspectorPreferences>) => void;
  inputClasses: string;
}) {
  const toggleDay = (day: string) => {
    const current = prefs.dayTripPrefs.availableDays;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    update({
      dayTripPrefs: { ...prefs.dayTripPrefs, availableDays: next },
      availableDays: next,
    });
  };

  return (
    <>
      <p className="text-xs text-primary-600/50 -mt-1">
        For farms close to home (no overnight stay).
      </p>

      {/* Available days */}
      <div>
        <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-2">
          Available Days
        </label>
        <div className="flex gap-1.5">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`w-9 h-9 rounded-[var(--radius-md)] text-xs font-bold transition-all duration-200 cursor-pointer ${
                prefs.dayTripPrefs.availableDays.includes(day)
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-earth-100 text-earth-300 hover:bg-earth-200"
              }`}
            >
              {day.charAt(0)}
            </button>
          ))}
        </div>
      </div>

      {/* Max inspections + max distance */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Max inspections/day
          </label>
          <input
            type="number"
            min={1}
            max={6}
            value={prefs.dayTripPrefs.maxDailyInspections}
            onChange={(e) =>
              update({
                dayTripPrefs: {
                  ...prefs.dayTripPrefs,
                  maxDailyInspections: parseInt(e.target.value) || 3,
                },
                maxDailyInspections: parseInt(e.target.value) || 3,
              })
            }
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Max one-way (mi)
          </label>
          <input
            type="number"
            min={10}
            max={300}
            value={prefs.dayTripPrefs.maxOneWayMiles}
            onChange={(e) =>
              update({
                dayTripPrefs: {
                  ...prefs.dayTripPrefs,
                  maxOneWayMiles: parseInt(e.target.value) || 75,
                },
                maxDayTripMiles: parseInt(e.target.value) || 75,
              })
            }
            className={inputClasses}
          />
        </div>
      </div>

      {/* Day trip threshold */}
      <div>
        <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
          Day/Travel trip threshold
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={60}
            max={360}
            step={15}
            value={prefs.dayTripThresholdMinutes}
            onChange={(e) =>
              update({ dayTripThresholdMinutes: parseInt(e.target.value) })
            }
            className="flex-1 accent-emerald-600"
          />
          <span className="text-sm font-semibold text-primary-700 tabular-nums w-12 text-right">
            {Math.floor(prefs.dayTripThresholdMinutes / 60)}h{prefs.dayTripThresholdMinutes % 60 > 0 ? ` ${prefs.dayTripThresholdMinutes % 60}m` : ""}
          </span>
        </div>
        <p className="text-[11px] text-primary-600/40 mt-1">
          One-way drive time cutoff. Beyond this = overnight travel trip.
        </p>
      </div>
    </>
  );
}

/* ── Travel Trip Tab ── */
function TravelTripTab({
  prefs,
  update,
  inputClasses,
}: {
  prefs: InspectorPreferences;
  update: (patch: Partial<InspectorPreferences>) => void;
  inputClasses: string;
}) {
  const toggleDay = (day: string) => {
    const current = prefs.travelTripPrefs.availableDays;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    update({
      travelTripPrefs: { ...prefs.travelTripPrefs, availableDays: next },
    });
  };

  return (
    <>
      <p className="text-xs text-primary-600/50 -mt-1">
        For multi-day trips away from home.
      </p>

      {/* Available days */}
      <div>
        <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-2">
          Work Days on Travel
        </label>
        <div className="flex gap-1.5">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`w-9 h-9 rounded-[var(--radius-md)] text-xs font-bold transition-all duration-200 cursor-pointer ${
                prefs.travelTripPrefs.availableDays.includes(day)
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-earth-100 text-earth-300 hover:bg-earth-200"
              }`}
            >
              {day.charAt(0)}
            </button>
          ))}
        </div>
      </div>

      {/* Max inspections + trip length */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Max inspections/day
          </label>
          <input
            type="number"
            min={1}
            max={6}
            value={prefs.travelTripPrefs.maxDailyInspections}
            onChange={(e) =>
              update({
                travelTripPrefs: {
                  ...prefs.travelTripPrefs,
                  maxDailyInspections: parseInt(e.target.value) || 4,
                },
              })
            }
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Trip length (days)
          </label>
          <input
            type="number"
            min={1}
            max={14}
            value={prefs.travelTripPrefs.preferredTripLengthDays}
            onChange={(e) =>
              update({
                travelTripPrefs: {
                  ...prefs.travelTripPrefs,
                  preferredTripLengthDays: parseInt(e.target.value) || 4,
                },
                preferredTripLengthDays: parseInt(e.target.value) || 4,
              })
            }
            className={inputClasses}
          />
        </div>
      </div>

      {/* Rest days + trip style */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Rest days between
          </label>
          <input
            type="number"
            min={0}
            max={7}
            value={prefs.travelTripPrefs.restDaysBetweenTrips}
            onChange={(e) =>
              update({
                travelTripPrefs: {
                  ...prefs.travelTripPrefs,
                  restDaysBetweenTrips: parseInt(e.target.value) || 0,
                },
                restDaysBetweenTrips: parseInt(e.target.value) || 0,
              })
            }
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Trip style
          </label>
          <div className="flex gap-1.5">
            {(["linear", "pinwheel"] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() =>
                  update({
                    travelTripPrefs: {
                      ...prefs.travelTripPrefs,
                      tripStyle: style,
                    },
                    tripStyle: style,
                  })
                }
                className={`flex-1 px-2 py-2 rounded-[var(--radius-md)] border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  prefs.travelTripPrefs.tripStyle === style
                    ? "bg-blue-50 border-blue-400 text-blue-700"
                    : "bg-white border-earth-200 text-primary-600/40 hover:border-earth-300"
                }`}
              >
                {style === "linear" ? "Linear" : "Hub"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── General Tab ── */
function GeneralTab({
  prefs,
  update,
  inputClasses,
}: {
  prefs: InspectorPreferences;
  update: (patch: Partial<InspectorPreferences>) => void;
  inputClasses: string;
}) {
  return (
    <>
      {/* Work hours */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Start time
          </label>
          <select
            value={prefs.workStartHour}
            onChange={(e) =>
              update({ workStartHour: parseInt(e.target.value) })
            }
            className={inputClasses}
          >
            {Array.from({ length: 12 }, (_, i) => i + 5).map((h) => (
              <option key={h} value={h}>
                {h === 12 ? "12:00 PM" : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            End time
          </label>
          <select
            value={prefs.workEndHour}
            onChange={(e) =>
              update({ workEndHour: parseInt(e.target.value) })
            }
            className={inputClasses}
          >
            {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => (
              <option key={h} value={h}>
                {h === 12 ? "12:00 PM" : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lunch preference */}
      <div className="bg-earth-50 rounded-[var(--radius-lg)] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-xs font-semibold text-primary-700">
              Lunch Break
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              update({
                lunchPreference: {
                  ...prefs.lunchPreference,
                  takeLunchBreak: !prefs.lunchPreference.takeLunchBreak,
                },
              })
            }
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
              prefs.lunchPreference.takeLunchBreak
                ? "bg-primary-500"
                : "bg-earth-200"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                prefs.lunchPreference.takeLunchBreak
                  ? "translate-x-5"
                  : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {prefs.lunchPreference.takeLunchBreak && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={15}
              max={90}
              step={5}
              value={prefs.lunchPreference.lunchBreakMinutes}
              onChange={(e) =>
                update({
                  lunchPreference: {
                    ...prefs.lunchPreference,
                    lunchBreakMinutes: parseInt(e.target.value) || 30,
                  },
                })
              }
              className="w-16 px-2 py-1 border border-earth-200 rounded-[var(--radius-sm)] text-sm text-primary-800 font-medium text-center"
            />
            <span className="text-xs text-primary-600/50">minutes</span>
          </div>
        )}
      </div>

      {/* Max daily drive + annual target */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Max daily drive (mi)
          </label>
          <input
            type="number"
            min={50}
            max={500}
            value={prefs.maxDailyDriveMiles}
            onChange={(e) =>
              update({
                maxDailyDriveMiles: parseInt(e.target.value) || 200,
              })
            }
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
            Annual target
          </label>
          <input
            type="number"
            min={1}
            max={500}
            value={prefs.annualInspectionTarget}
            onChange={(e) =>
              update({
                annualInspectionTarget: parseInt(e.target.value) || 100,
              })
            }
            className={inputClasses}
          />
        </div>
      </div>

      {/* Start date */}
      <div>
        <label className="block text-[11px] font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
          <Calendar className="w-3 h-3 inline mr-1" />
          Schedule start date
        </label>
        <input
          type="date"
          value={prefs.startDate}
          onChange={(e) => update({ startDate: e.target.value })}
          className={inputClasses}
        />
      </div>
    </>
  );
}
