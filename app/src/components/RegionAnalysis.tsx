"use client";

import {
  MapPin,
  AlertTriangle,
  Car,
  Clock,
  Calendar,
  Briefcase,
} from "lucide-react";
import { FarmCluster, RegionAnalysis as RegionAnalysisType } from "@/lib/types";

interface RegionAnalysisProps {
  analysis: RegionAnalysisType;
}

export default function RegionAnalysis({ analysis }: RegionAnalysisProps) {
  const { clusters, dayTripFarms, multiDayFarms, totalFarms, urgentFarms, warnings } = analysis;

  const multiDayClusters = clusters.filter((c) => c.tripType === "multi_day");
  const dayTripClusters = clusters.filter((c) => c.tripType === "day_trip");

  return (
    <div className="space-y-6">
      {/* Summary sentence */}
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-primary-800 mb-3">
          Region Analysis
        </h2>
        <p className="text-sm sm:text-base text-primary-700/60 max-w-lg mx-auto leading-relaxed">
          You have{" "}
          <span className="font-semibold text-primary-700">{totalFarms} inspectable farms</span>
          {" "}&mdash;{" "}
          <span className="font-semibold text-emerald-600">{dayTripFarms.length} day trips</span>
          {multiDayFarms.length > 0 && (
            <>
              {" "}and{" "}
              <span className="font-semibold text-blue-600">
                {multiDayFarms.length} requiring travel
              </span>
              {" "}across {multiDayClusters.length} region{multiDayClusters.length !== 1 ? "s" : ""}
            </>
          )}
          .
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius-lg)] p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 space-y-1">
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Multi-day clusters */}
      {multiDayClusters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary-700/60 uppercase tracking-wider mb-3">
            Travel Trips (Overnight Required)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {multiDayClusters.map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      )}

      {/* Day trip clusters */}
      {dayTripClusters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary-700/60 uppercase tracking-wider mb-3">
            Day Trips (No Overnight)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dayTripClusters.map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: FarmCluster }) {
  const isMultiDay = cluster.tripType === "multi_day";
  const accentColor = isMultiDay ? "blue" : "emerald";

  const formatDriveTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div
      className={`bg-white border rounded-[var(--radius-xl)] p-5 transition-all duration-200 ${
        isMultiDay
          ? "border-blue-200 hover:border-blue-300"
          : "border-emerald-200 hover:border-emerald-300"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className={`w-4 h-4 text-${accentColor}-500`} />
            <h4 className="font-semibold text-primary-800">{cluster.label}</h4>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isMultiDay
                ? "bg-blue-50 text-blue-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isMultiDay ? "Travel Trip" : "Day Trip"}
          </span>
        </div>
        {cluster.urgentCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            {cluster.urgentCount} urgent
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-primary-400" />
          <span className="text-primary-700">
            <span className="font-semibold">{cluster.farms.length}</span> farm{cluster.farms.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Car className="w-3.5 h-3.5 text-primary-400" />
          <span className="text-primary-700">
            <span className="font-semibold">{cluster.avgDistanceFromHomeMiles}</span> mi
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary-400" />
          <span className="text-primary-700">
            {formatDriveTime(cluster.driveTimeFromHomeMinutes)} drive
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-primary-400" />
          <span className="text-primary-700">
            ~{cluster.suggestedTripDays} day{cluster.suggestedTripDays !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Completion window */}
      {cluster.completionWindows.earliest && (
        <div className="mt-3 pt-3 border-t border-earth-100 text-xs text-primary-600/60">
          Window: {formatDate(cluster.completionWindows.earliest)}
          {cluster.completionWindows.latest && (
            <> &ndash; {formatDate(cluster.completionWindows.latest)}</>
          )}
        </div>
      )}

      {/* Farm list preview */}
      <div className="mt-3 pt-3 border-t border-earth-100">
        <div className="flex flex-wrap gap-1">
          {cluster.farms.slice(0, 4).map((f) => (
            <span
              key={f.id}
              className={`text-[11px] px-1.5 py-0.5 rounded-[var(--radius-sm)] ${
                f.priority === "urgent"
                  ? "bg-red-50 text-red-700 font-semibold"
                  : "bg-earth-50 text-primary-600/70"
              }`}
            >
              {f.name.length > 20 ? f.name.slice(0, 20) + "..." : f.name}
            </span>
          ))}
          {cluster.farms.length > 4 && (
            <span className="text-[11px] px-1.5 py-0.5 text-primary-600/40">
              +{cluster.farms.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
