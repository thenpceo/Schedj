"use client";

import { useState, useCallback } from "react";
import {
  Calendar,
  Lock,
  Unlock,
  ArrowRight,
  Car,
  MapPin,
} from "lucide-react";
import {
  FarmCluster,
  RegionAnalysis,
  TripPlan,
  InspectorPreferences,
} from "@/lib/types";

interface TripPlannerProps {
  analysis: RegionAnalysis;
  prefs: InspectorPreferences;
  onGenerateSchedule: (tripPlans: TripPlan[], prefs: InspectorPreferences) => void;
}

export default function TripPlanner({
  analysis,
  prefs,
  onGenerateSchedule,
}: TripPlannerProps) {
  const multiDayClusters = analysis.clusters.filter(
    (c) => c.tripType === "multi_day"
  );

  // Initialize trip plans from multi-day clusters
  const [tripPlans, setTripPlans] = useState<TripPlan[]>(() =>
    multiDayClusters.map((cluster) => ({
      clusterId: cluster.id,
      tripType: "multi_day",
      preferredStartDate: cluster.completionWindows.earliest || prefs.startDate,
      locked: false,
      farms: cluster.farms,
    }))
  );

  const updatePlan = useCallback(
    (clusterId: string, updates: Partial<TripPlan>) => {
      setTripPlans((prev) =>
        prev.map((p) =>
          p.clusterId === clusterId ? { ...p, ...updates } : p
        )
      );
    },
    []
  );

  const toggleLock = useCallback((clusterId: string) => {
    setTripPlans((prev) =>
      prev.map((p) =>
        p.clusterId === clusterId ? { ...p, locked: !p.locked } : p
      )
    );
  }, []);

  const allLocked = multiDayClusters.length === 0 || tripPlans.every((p) => p.locked);

  const handleGenerate = () => {
    onGenerateSchedule(tripPlans, prefs);
  };

  return (
    <div className="space-y-6 mt-8">
      {/* Multi-day trip planning */}
      {multiDayClusters.length > 0 && (
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-primary-800 mb-1">
            Plan Your Travel Trips
          </h3>
          <p className="text-sm text-primary-600/60 mb-4">
            Pick when you&apos;d like to visit each region. Lock in your dates, then generate the schedule.
          </p>

          <div className="space-y-3">
            {multiDayClusters.map((cluster) => {
              const plan = tripPlans.find(
                (p) => p.clusterId === cluster.id
              );
              if (!plan) return null;
              return (
                <TripPlanRow
                  key={cluster.id}
                  cluster={cluster}
                  plan={plan}
                  onUpdatePlan={updatePlan}
                  onToggleLock={toggleLock}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Day trip summary */}
      {analysis.dayTripFarms.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-[var(--radius-lg)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Car className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">
              {analysis.dayTripFarms.length} Day Trip Farm{analysis.dayTripFarms.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-emerald-700/70">
            These farms are close enough for day trips and will be automatically scheduled
            around your travel trips, respecting your available days.
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!allLocked && multiDayClusters.length > 0}
        className="w-full py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-[var(--radius-lg)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {!allLocked && multiDayClusters.length > 0
          ? "Lock in all travel trips to continue"
          : "Generate Schedule"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function TripPlanRow({
  cluster,
  plan,
  onUpdatePlan,
  onToggleLock,
}: {
  cluster: FarmCluster;
  plan: TripPlan;
  onUpdatePlan: (clusterId: string, updates: Partial<TripPlan>) => void;
  onToggleLock: (clusterId: string) => void;
}) {
  return (
    <div
      className={`border rounded-[var(--radius-lg)] p-4 transition-all duration-200 ${
        plan.locked
          ? "bg-blue-50/50 border-blue-300"
          : "bg-white border-earth-200"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: cluster info */}
        <div className="flex items-center gap-3 min-w-0">
          <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-primary-800 text-sm truncate">
              {cluster.label}
            </div>
            <div className="text-xs text-primary-600/50">
              {cluster.farms.length} farms &middot; ~{cluster.suggestedTripDays} days
            </div>
          </div>
        </div>

        {/* Right: date picker + lock */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary-400" />
            <input
              type="date"
              value={plan.preferredStartDate || ""}
              onChange={(e) =>
                onUpdatePlan(cluster.id, {
                  preferredStartDate: e.target.value,
                })
              }
              disabled={plan.locked}
              min={cluster.completionWindows.earliest || undefined}
              max={cluster.completionWindows.latest || undefined}
              className="px-2 py-1.5 border border-earth-200 rounded-[var(--radius-md)] text-sm text-primary-800 focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 disabled:bg-earth-50 disabled:text-primary-600/50 w-[140px]"
            />
          </div>
          <button
            type="button"
            onClick={() => onToggleLock(cluster.id)}
            className={`p-2 rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer ${
              plan.locked
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-earth-100 text-earth-400 hover:bg-earth-200 hover:text-primary-600"
            }`}
            title={plan.locked ? "Unlock to change date" : "Lock in this date"}
          >
            {plan.locked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
