"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  SlidersHorizontal,
  CalendarDays,
  Check,
  ArrowLeft,
  Leaf,
  Sprout,
} from "lucide-react";
import { Farm, InspectorPreferences, Schedule, AppStep } from "@/lib/types";
import { generateSchedule } from "@/lib/scheduler";
import FileUpload from "@/components/FileUpload";
import PreferencesForm from "@/components/PreferencesForm";
import ScheduleView from "@/components/ScheduleView";

const STEPS: { key: AppStep; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload Data", shortLabel: "Upload", icon: Upload },
  { key: "preferences", label: "Preferences", shortLabel: "Prefs", icon: SlidersHorizontal },
  { key: "schedule", label: "Schedule", shortLabel: "Schedule", icon: CalendarDays },
];

export default function Home() {
  const [step, setStep] = useState<AppStep>("upload");
  const [farms, setFarms] = useState<Farm[]>([]);
  const [prefs, setPrefs] = useState<InspectorPreferences | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const handleFarmsLoaded = useCallback((loadedFarms: Farm[], _skipped: Farm[]) => {
    setFarms(loadedFarms);
  }, []);

  const handlePrefsSubmit = useCallback(
    (submittedPrefs: InspectorPreferences) => {
      setPrefs(submittedPrefs);
      const result = generateSchedule(farms, submittedPrefs);
      setSchedule(result);
      setStep("schedule");
    },
    [farms]
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
        {stepIndex > 0 && (
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
                  <button
                    onClick={() => setStep("preferences")}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-[var(--radius-lg)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98]"
                  >
                    Continue to Preferences
                  </button>
                </div>
              )}
            </>
          )}

          {step === "preferences" && (
            <PreferencesForm
              onSubmit={handlePrefsSubmit}
              farmCount={farms.length}
            />
          )}

          {step === "schedule" && schedule && (
            <ScheduleView schedule={schedule} prefs={prefs!} />
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
