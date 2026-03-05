"use client";

import { useState } from "react";
import { MapPin, Clock, Route, Calendar, ArrowRight, User, Shield } from "lucide-react";
import { InspectorPreferences, AVAILABLE_CERTIFICATIONS } from "@/lib/types";
import { SAMPLE_PREFERENCES } from "@/lib/sample-data";

interface PreferencesFormProps {
  initialPrefs?: InspectorPreferences;
  onSubmit: (prefs: InspectorPreferences) => void;
  farmCount: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PreferencesForm({
  initialPrefs,
  onSubmit,
  farmCount,
}: PreferencesFormProps) {
  const [prefs, setPrefs] = useState<InspectorPreferences>(
    initialPrefs || SAMPLE_PREFERENCES
  );

  const update = <K extends keyof InspectorPreferences>(
    key: K,
    value: InspectorPreferences[K]
  ) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: string) => {
    setPrefs((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  const toggleCert = (cert: string) => {
    setPrefs((prev) => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter((c) => c !== cert)
        : [...prev.certifications, cert],
    }));
  };

  const inputClasses =
    "w-full px-3.5 py-2.5 bg-white border border-earth-200 rounded-[var(--radius-md)] focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 text-primary-800 font-medium text-sm transition-all duration-200 placeholder:text-primary-600/30";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10">
        <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-primary-800 mb-3">
          Your Preferences
        </h2>
        <p className="text-sm sm:text-base text-primary-700/60 max-w-md mx-auto leading-relaxed">
          Set your profile and scheduling preferences so we can build an
          optimal route for your{" "}
          <span className="font-semibold text-primary-700">{farmCount} inspections</span>.
        </p>
      </div>

      <div className="space-y-5 stagger-children">
        {/* ── Inspector Profile ── */}
        <section className="bg-white border border-earth-200 rounded-[var(--radius-xl)] p-5 sm:p-6 animate-fade-in-up">
          <SectionHeader icon={User} title="Inspector Profile" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label htmlFor="inspectorName" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                id="inspectorName"
                type="text"
                value={prefs.inspectorName}
                onChange={(e) => update("inspectorName", e.target.value)}
                className={inputClasses}
                placeholder="e.g., Levi Sterner"
              />
            </div>
            <div>
              <label htmlFor="inspectorEmail" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                id="inspectorEmail"
                type="email"
                value={prefs.inspectorEmail}
                onChange={(e) => update("inspectorEmail", e.target.value)}
                className={inputClasses}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label htmlFor="inspectorPhone" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Phone
              </label>
              <input
                id="inspectorPhone"
                type="tel"
                value={prefs.inspectorPhone}
                onChange={(e) => update("inspectorPhone", e.target.value)}
                className={inputClasses}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* Certifications */}
          <div className="mt-5">
            <label className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-2.5">
              Certifications
            </label>
            <div className="flex gap-2 flex-wrap">
              {AVAILABLE_CERTIFICATIONS.map((cert) => (
                <button
                  key={cert}
                  type="button"
                  onClick={() => toggleCert(cert)}
                  className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold transition-all duration-200 cursor-pointer ${
                    prefs.certifications.includes(cert)
                      ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
                      : "bg-earth-100 text-earth-300 hover:bg-earth-200 hover:text-primary-700/50"
                  }`}
                  aria-pressed={prefs.certifications.includes(cert)}
                >
                  {cert}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Home Location ── */}
        <section className="bg-white border border-earth-200 rounded-[var(--radius-xl)] p-5 sm:p-6 animate-fade-in-up">
          <SectionHeader icon={MapPin} title="Home Base" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="sm:col-span-3">
              <label htmlFor="homeAddress" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Home City / Address
              </label>
              <input
                id="homeAddress"
                type="text"
                value={prefs.homeAddress}
                onChange={(e) => update("homeAddress", e.target.value)}
                className={inputClasses}
                placeholder="e.g., Salem, OR"
              />
            </div>
            <div>
              <label htmlFor="homeLat" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Latitude
              </label>
              <input
                id="homeLat"
                type="number"
                step="0.0001"
                value={prefs.homeLat}
                onChange={(e) => update("homeLat", parseFloat(e.target.value) || 0)}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="homeLng" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Longitude
              </label>
              <input
                id="homeLng"
                type="number"
                step="0.0001"
                value={prefs.homeLng}
                onChange={(e) => update("homeLng", parseFloat(e.target.value) || 0)}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="maxDrive" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Max daily drive (mi)
              </label>
              <input
                id="maxDrive"
                type="number"
                value={prefs.maxDailyDriveMiles}
                onChange={(e) =>
                  update("maxDailyDriveMiles", parseInt(e.target.value) || 100)
                }
                className={inputClasses}
              />
            </div>
          </div>
        </section>

        {/* ── Trip Preferences ── */}
        <section className="bg-white border border-earth-200 rounded-[var(--radius-xl)] p-5 sm:p-6 animate-fade-in-up">
          <SectionHeader icon={Route} title="Trip Planning" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="tripLength" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Preferred trip length (days)
              </label>
              <input
                id="tripLength"
                type="number"
                min={1}
                max={14}
                value={prefs.preferredTripLengthDays}
                onChange={(e) =>
                  update("preferredTripLengthDays", parseInt(e.target.value) || 3)
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Trip planning style
              </label>
              <div className="flex gap-2">
                {(["linear", "pinwheel"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => update("tripStyle", style)}
                    className={`flex-1 px-3 py-2.5 rounded-[var(--radius-md)] border text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      prefs.tripStyle === style
                        ? "bg-primary-50 border-primary-400 text-primary-700 ring-1 ring-primary-200"
                        : "bg-white border-earth-200 text-primary-700/50 hover:bg-earth-50 hover:border-earth-300"
                    }`}
                  >
                    {style === "linear" ? "Linear" : "Pinwheel"}
                    <span className="block text-[11px] font-medium mt-0.5 opacity-60">
                      {style === "linear" ? "A \u2192 B \u2192 C \u2192 Home" : "Hub & spoke"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Scheduling Limits ── */}
        <section className="bg-white border border-earth-200 rounded-[var(--radius-xl)] p-5 sm:p-6 animate-fade-in-up">
          <SectionHeader icon={Shield} title="Scheduling Limits" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="annualTarget" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Annual target
              </label>
              <input
                id="annualTarget"
                type="number"
                min={1}
                max={500}
                value={prefs.annualInspectionTarget}
                onChange={(e) =>
                  update("annualInspectionTarget", parseInt(e.target.value) || 100)
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="maxDayTrip" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Max day trip (mi)
              </label>
              <input
                id="maxDayTrip"
                type="number"
                min={10}
                max={300}
                value={prefs.maxDayTripMiles}
                onChange={(e) =>
                  update("maxDayTripMiles", parseInt(e.target.value) || 75)
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="maxDailyInsp" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Max inspections/day
              </label>
              <input
                id="maxDailyInsp"
                type="number"
                min={1}
                max={6}
                value={prefs.maxDailyInspections}
                onChange={(e) =>
                  update("maxDailyInspections", parseInt(e.target.value) || 3)
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="restDays" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Rest days between trips
              </label>
              <input
                id="restDays"
                type="number"
                min={0}
                max={7}
                value={prefs.restDaysBetweenTrips}
                onChange={(e) =>
                  update("restDaysBetweenTrips", parseInt(e.target.value) || 0)
                }
                className={inputClasses}
              />
            </div>
          </div>
        </section>

        {/* ── Work Schedule ── */}
        <section className="bg-white border border-earth-200 rounded-[var(--radius-xl)] p-5 sm:p-6 animate-fade-in-up">
          <SectionHeader icon={Clock} title="Work Schedule" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="startTime" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                Start time
              </label>
              <select
                id="startTime"
                value={prefs.workStartHour}
                onChange={(e) => update("workStartHour", parseInt(e.target.value))}
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
              <label htmlFor="endTime" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
                End time
              </label>
              <select
                id="endTime"
                value={prefs.workEndHour}
                onChange={(e) => update("workEndHour", parseInt(e.target.value))}
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

          {/* Available Days */}
          <div className="mt-5">
            <label className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-2.5">
              Available days
            </label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-[var(--radius-md)] text-sm font-bold transition-all duration-200 cursor-pointer ${
                    prefs.availableDays.includes(day)
                      ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
                      : "bg-earth-100 text-earth-300 hover:bg-earth-200 hover:text-primary-700/50"
                  }`}
                  aria-pressed={prefs.availableDays.includes(day)}
                  aria-label={day}
                >
                  {day.charAt(0)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Start Date ── */}
        <section className="bg-white border border-earth-200 rounded-[var(--radius-xl)] p-5 sm:p-6 animate-fade-in-up">
          <SectionHeader icon={Calendar} title="Start Date" />
          <div className="mt-4">
            <label htmlFor="startDate" className="block text-xs font-semibold text-primary-700/60 uppercase tracking-wider mb-1.5">
              Begin scheduling from
            </label>
            <input
              id="startDate"
              type="date"
              value={prefs.startDate}
              onChange={(e) => update("startDate", e.target.value)}
              className={`${inputClasses} max-w-xs`}
            />
          </div>
        </section>

        {/* ── Generate ── */}
        <button
          type="button"
          onClick={() => onSubmit(prefs)}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-[var(--radius-lg)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98] inline-flex items-center justify-center gap-2"
        >
          Generate Schedule
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-primary-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary-600" />
      </div>
      <h3 className="font-[family-name:var(--font-display)] font-semibold text-primary-800">
        {title}
      </h3>
    </div>
  );
}
