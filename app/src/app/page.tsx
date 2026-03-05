"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Upload,
  BarChart3,
  CalendarDays,
  Check,
  ArrowLeft,
  Leaf,
  Sprout,
  MapPin,
  Loader2,
} from "lucide-react";
import { Farm, InspectorPreferences, AppStep, RegionAnalysis as RegionAnalysisType, TripPlan, ScheduleEdit } from "@/lib/types";
import { analyzeRegions } from "@/lib/analyzer";
import { applyEdit } from "@/lib/schedule-editor";
import { geocodeFarms, countUngeocoded } from "@/lib/geocode";
import { SAMPLE_PREFERENCES } from "@/lib/sample-data";
import { useScheduler } from "@/hooks/useScheduler";
import FileUpload from "@/components/FileUpload";
import SchedulePanel from "@/components/SchedulePanel";
import RegionAnalysis from "@/components/RegionAnalysis";
import TripPlanner from "@/components/TripPlanner";
import SplitScreenLayout from "@/components/SplitScreenLayout";
import PreferencesPanel from "@/components/PreferencesPanel";

const STEPS: { key: AppStep; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload Data", shortLabel: "Upload", icon: Upload },
  { key: "analyze", label: "Analyze", shortLabel: "Analyze", icon: BarChart3 },
  { key: "plan", label: "Plan", shortLabel: "Plan", icon: CalendarDays },
];

export default function Home() {
  const [step, setStep] = useState<AppStep>("upload");
  const [farms, setFarms] = useState<Farm[]>([]);
  const [prefs, setPrefs] = useState<InspectorPreferences>(SAMPLE_PREFERENCES);
  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [farmUnavailableDates, setFarmUnavailableDates] = useState<Record<string, string[]>>({});

  // Geocoding state
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ completed: 0, total: 0 });
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // Compute region analysis when we have farms
  const regionAnalysis: RegionAnalysisType | null = useMemo(() => {
    if (farms.length === 0) return null;
    const inspectable = farms.filter((f) => f.priority !== "do_not_inspect");
    if (inspectable.length === 0) return null;
    return analyzeRegions(inspectable, prefs);
  }, [farms, prefs]);

  const handleFarmsLoaded = useCallback((loadedFarms: Farm[], _skipped: Farm[]) => {
    setFarms(loadedFarms);
    setGeocodeError(null);
  }, []);

  const handleContinueToAnalyze = useCallback(async () => {
    const needsGeo = farms.filter((f) => f.lat === 0 && f.lng === 0).length;

    if (needsGeo > 0) {
      setIsGeocoding(true);
      setGeocodeProgress({ completed: 0, total: 0 });
      setGeocodeError(null);

      try {
        const geocoded = await geocodeFarms(farms, (completed, total) => {
          setGeocodeProgress({ completed, total });
        });
        setFarms(geocoded);

        const remaining = countUngeocoded(geocoded);
        if (remaining > 0) {
          setGeocodeError(
            `${remaining} farm(s) could not be geocoded. They will use approximate locations.`
          );
        }

        setIsGeocoding(false);
        setStep("analyze");
      } catch {
        setIsGeocoding(false);
        setGeocodeError("Geocoding failed. Please check your internet connection and try again.");
      }
    } else {
      setStep("analyze");
    }
  }, [farms]);

  // Live scheduler: recomputes whenever prefs, tripPlans, or unavailableDates change
  const schedulerPrefs = step === "plan" ? prefs : null;
  const { schedule, isComputing } = useScheduler(
    farms,
    schedulerPrefs,
    tripPlans.length > 0 ? tripPlans : undefined,
    Object.keys(farmUnavailableDates).length > 0 ? farmUnavailableDates : undefined
  );

  const handleGenerateFromTripPlanner = useCallback(
    (plans: TripPlan[], submittedPrefs: InspectorPreferences) => {
      setPrefs(submittedPrefs);
      setTripPlans(plans);
      setStep("plan");
    },
    []
  );

  const handleScheduleEdit = useCallback(
    (edit: ScheduleEdit) => {
      setFarmUnavailableDates((prev) => applyEdit(edit, prev));
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-primary-100/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-primary-700 rounded-[var(--radius-md)] flex items-center justify-center shadow-sm">
                <Leaf className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-[family-name:var(--font-display)] font-bold text-xl text-primary-800 tracking-tight">
                  SCHEDJ
                </span>
                <span className="text-[11px] font-medium text-primary-600/60 tracking-wide uppercase hidden sm:inline">
                  Inspector
                </span>
              </div>
            </div>

            {/* Step indicator */}
            <nav className="flex items-center" aria-label="Progress">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isCurrent = s.key === step;
                const isCompleted = i < stepIndex;
                const isClickable = isCompleted;
                return (
                  <div key={s.key} className="flex items-center">
                    {i > 0 && (
                      <div className={`w-6 sm:w-10 h-[2px] mx-0.5 sm:mx-1 rounded-full transition-colors duration-300 ${
                        isCompleted ? "bg-primary-400" : "bg-earth-200"
                      }`} />
                    )}
                    <button
                      onClick={() => isClickable && setStep(s.key)}
                      disabled={!isClickable && !isCurrent}
                      className={`
                        flex items-center gap-1.5 rounded-full transition-all duration-200
                        ${isCurrent
                          ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200 px-3 sm:px-4 py-2"
                          : isCompleted
                            ? "text-primary-600 hover:bg-primary-50 cursor-pointer px-2 sm:px-3 py-2"
                            : "text-earth-300 cursor-default px-2 sm:px-3 py-2"
                        }
                      `}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {isCompleted ? (
                        <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      <span className="text-sm font-semibold hidden sm:inline">{s.label}</span>
                      <span className="text-xs font-semibold sm:hidden">{s.shortLabel}</span>
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Back navigation */}
        {stepIndex > 0 && !isGeocoding && (
          <button
            onClick={() => setStep(STEPS[stepIndex - 1].key)}
            className="mb-6 text-sm text-primary-600/70 hover:text-primary-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-200 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
            Back to {STEPS[stepIndex - 1].label}
          </button>
        )}

        {/* Step content with animation */}
        <div className="animate-fade-in-up">
          {step === "upload" && (
            <>
              <FileUpload onFarmsLoaded={handleFarmsLoaded} />
              {farms.length > 0 && (
                <div className="max-w-2xl mx-auto mt-8 animate-fade-in-up">
                  {/* Geocoding progress */}
                  {isGeocoding && (
                    <div className="mb-4 p-4 bg-primary-50 rounded-[var(--radius-lg)] border border-primary-100">
                      <div className="flex items-center gap-3 mb-2">
                        <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                        <span className="text-sm font-medium text-primary-700">
                          Geocoding addresses...
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-primary-500" />
                        <div className="flex-1">
                          <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all duration-300"
                              style={{
                                width: geocodeProgress.total > 0
                                  ? `${(geocodeProgress.completed / geocodeProgress.total) * 100}%`
                                  : "0%",
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-primary-600 tabular-nums">
                          {geocodeProgress.completed}/{geocodeProgress.total} locations
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Geocoding error/warning */}
                  {geocodeError && !isGeocoding && (
                    <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-[var(--radius-md)] border border-amber-200">
                      {geocodeError}
                    </div>
                  )}

                  <button
                    onClick={handleContinueToAnalyze}
                    disabled={isGeocoding}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-[var(--radius-lg)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeocoding ? "Geocoding..." : "Analyze Regions"}
                  </button>
                </div>
              )}
            </>
          )}

          {step === "analyze" && regionAnalysis && (
            <div className="max-w-3xl mx-auto">
              <RegionAnalysis analysis={regionAnalysis} />
              <TripPlanner
                analysis={regionAnalysis}
                prefs={prefs}
                onGenerateSchedule={handleGenerateFromTripPlanner}
              />
            </div>
          )}

          {step === "plan" && (
            <SplitScreenLayout
              left={
                <PreferencesPanel
                  prefs={prefs}
                  onChange={setPrefs}
                  isComputing={isComputing}
                />
              }
              right={
                schedule ? (
                  <SchedulePanel
                    schedule={schedule}
                    prefs={prefs}
                    isComputing={isComputing}
                    onEdit={handleScheduleEdit}
                  />
                ) : (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-primary-600/50">Generating schedule...</p>
                    </div>
                  </div>
                )
              }
            />
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-earth-200 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-2 text-xs text-primary-600/40">
          <Sprout className="w-3.5 h-3.5" />
          <span>SCHEDJ Prototype &middot; Organic Inspection Scheduling</span>
        </div>
      </footer>
    </div>
  );
}
