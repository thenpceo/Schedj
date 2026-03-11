"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Upload,
  Settings2,
  LayoutDashboard,
  Phone,
  Check,
  ArrowLeft,
  Leaf,
  Sprout,
} from "lucide-react";
import {
  Farm,
  InspectorPreferences,
  AppStep,
  TravelPrefs,
  ScheduleEdit,
} from "@/lib/types";
import { applyEdit } from "@/lib/schedule-editor";
import { SAMPLE_PREFERENCES } from "@/lib/sample-data";
import { useScheduler } from "@/hooks/useScheduler";
import UploadStep from "@/components/steps/UploadStep";
import PreferencesStep from "@/components/steps/PreferencesStep";
import WorkspaceStep from "@/components/steps/WorkspaceStep";
import ContactStep from "@/components/steps/ContactStep";

// V3 step definitions
const STEPS: { key: AppStep; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload Data", shortLabel: "Upload", icon: Upload },
  { key: "preferences", label: "Preferences", shortLabel: "Prefs", icon: Settings2 },
  { key: "workspace", label: "Workspace", shortLabel: "Work", icon: LayoutDashboard },
  { key: "contact", label: "Contact", shortLabel: "Contact", icon: Phone },
];

const PREFS_STORAGE_KEY = "schedj-prefs";
const PREFS_VERSION = 1;

function loadPrefsFromStorage(): InspectorPreferences {
  if (typeof window === "undefined") return SAMPLE_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return SAMPLE_PREFERENCES;
    const parsed = JSON.parse(raw);
    if (parsed.version !== PREFS_VERSION) return SAMPLE_PREFERENCES;
    const { version: _, ...saved } = parsed;
    return { ...SAMPLE_PREFERENCES, ...saved };
  } catch {
    return SAMPLE_PREFERENCES;
  }
}

export default function Home() {
  const [step, setStep] = useState<AppStep>("upload");
  const [farms, setFarms] = useState<Farm[]>([]);
  const [prefs, setPrefs] = useState<InspectorPreferences>(loadPrefsFromStorage);
  const [travelPrefs, setTravelPrefs] = useState<TravelPrefs | null>(null);
  const [farmUnavailableDates, setFarmUnavailableDates] = useState<Record<string, string[]>>({});

  // Persist preferences to localStorage
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

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Step handlers ──

  const handleFarmsLoaded = useCallback((loadedFarms: Farm[], _skipped: Farm[]) => {
    setFarms(loadedFarms);
  }, []);

  const handleUploadComplete = useCallback((geocodedFarms: Farm[]) => {
    setFarms(geocodedFarms);
    setStep("preferences");
  }, []);

  const handleGenerateSchedule = useCallback((tp: TravelPrefs) => {
    setTravelPrefs(tp);
    // Apply travel prefs to inspector preferences for scheduler compatibility
    setPrefs((prev) => ({
      ...prev,
      workStartHour: tp.workStartHour,
      workEndHour: tp.workEndHour,
      availableDays: tp.availableDays,
      maxDailyInspections: tp.inspectionsPerDay,
      maxDayTripMiles: tp.maxLocalDrivingRadiusMiles,
      maxDailyDriveMiles: tp.maxDrivingDistanceMiles,
      preferredTripLengthDays: tp.maxDaysAway,
      dayTripPrefs: {
        ...prev.dayTripPrefs,
        availableDays: tp.availableDays,
        maxDailyInspections: tp.inspectionsPerDay,
        maxOneWayMiles: tp.maxLocalDrivingRadiusMiles,
      },
      travelTripPrefs: {
        ...prev.travelTripPrefs,
        availableDays: tp.availableDays,
        maxDailyInspections: tp.inspectionsPerDay,
        preferredTripLengthDays: tp.maxDaysAway,
      },
    }));
    setStep("workspace");
  }, []);

  const handleScheduleEdit = useCallback((edit: ScheduleEdit) => {
    setFarmUnavailableDates((prev) => applyEdit(edit, prev));
  }, []);

  // Live scheduler: only compute when on workspace or contact step
  const schedulerPrefs = (step === "workspace" || step === "contact") ? prefs : null;
  const { schedule, isComputing } = useScheduler(
    farms,
    schedulerPrefs,
    undefined,
    Object.keys(farmUnavailableDates).length > 0 ? farmUnavailableDates : undefined
  );

  // ── Step navigation ──

  const goToStep = useCallback((target: AppStep) => {
    // Reset downstream state when going backward
    if (target === "upload") {
      setTravelPrefs(null);
      setFarmUnavailableDates({});
    }
    if (target === "preferences") {
      setFarmUnavailableDates({});
    }
    setStep(target);
  }, []);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    const target = STEPS[stepIndex - 1].key;
    goToStep(target);
  }, [stepIndex, goToStep]);

  // beforeunload warning when edits exist
  useEffect(() => {
    if (step !== "workspace" && step !== "contact") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step]);

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
                      onClick={() => {
                        if (isClickable) goToStep(s.key);
                      }}
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
        {stepIndex > 0 && (
          <button
            onClick={goBack}
            className="mb-6 text-sm text-primary-600/70 hover:text-primary-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-200 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
            Back to {STEPS[stepIndex - 1].label}
          </button>
        )}

        {/* Step content */}
        <div className="animate-fade-in-up">
          {step === "upload" && (
            <UploadStep
              farms={farms}
              onFarmsLoaded={handleFarmsLoaded}
              onComplete={handleUploadComplete}
            />
          )}

          {step === "preferences" && (
            <PreferencesStep
              farms={farms}
              isGeocodingComplete={true}
              onGenerateSchedule={handleGenerateSchedule}
            />
          )}

          {step === "workspace" && (
            <WorkspaceStep
              farms={farms}
              schedule={schedule}
              prefs={prefs}
              isComputing={isComputing}
              travelPrefs={travelPrefs || {
                maxDaysAway: 4,
                maxDrivingDistanceMiles: 300,
                inspectionsPerDay: 3,
                maxLocalDrivingRadiusMiles: 75,
                workStartHour: 8,
                workEndHour: 17,
                availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
              }}
              onPrefsChange={setPrefs}
              onScheduleEdit={handleScheduleEdit}
            />
          )}

          {step === "contact" && (
            <ContactStep
              schedule={schedule}
              onBack={() => goToStep("workspace")}
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
