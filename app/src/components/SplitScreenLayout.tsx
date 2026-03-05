"use client";

import { useState } from "react";
import { SlidersHorizontal, CalendarDays } from "lucide-react";

interface SplitScreenLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export default function SplitScreenLayout({ left, right }: SplitScreenLayoutProps) {
  const [mobileTab, setMobileTab] = useState<"prefs" | "schedule">("schedule");

  return (
    <>
      {/* Mobile tab toggle */}
      <div className="lg:hidden flex bg-white border border-earth-200 rounded-[var(--radius-lg)] p-1 mb-4">
        <button
          onClick={() => setMobileTab("prefs")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold transition-all duration-200 cursor-pointer ${
            mobileTab === "prefs"
              ? "bg-primary-50 text-primary-700 shadow-sm"
              : "text-primary-600/50 hover:text-primary-600"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Preferences
        </button>
        <button
          onClick={() => setMobileTab("schedule")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold transition-all duration-200 cursor-pointer ${
            mobileTab === "schedule"
              ? "bg-primary-50 text-primary-700 shadow-sm"
              : "text-primary-600/50 hover:text-primary-600"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Schedule
        </button>
      </div>

      {/* Desktop: side-by-side / Mobile: tabbed */}
      <div className="lg:flex lg:gap-6 lg:items-start">
        {/* Left panel - preferences */}
        <div
          className={`lg:w-[380px] lg:shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:block ${
            mobileTab === "prefs" ? "block" : "hidden"
          }`}
        >
          {left}
        </div>

        {/* Right panel - schedule */}
        <div
          className={`lg:flex-1 lg:min-w-0 lg:block ${
            mobileTab === "schedule" ? "block" : "hidden"
          }`}
        >
          {right}
        </div>
      </div>
    </>
  );
}
