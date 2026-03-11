"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  List,
  CalendarDays,
  Map,
  Undo2,
  Redo2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  Farm,
  Schedule,
  InspectorPreferences,
  TripV3,
  WorkspaceTab,
  TravelPrefs,
  DayTripPrefsV3,
  ScheduleScore,
  ReturnedFarm,
  ScheduleEdit,
  TripEditHistory,
} from "@/lib/types";
import {
  createInitialHistory,
  createTripState,
  pushHistory,
  undoHistory,
  redoHistory,
  useUndoRedoKeys,
} from "@/hooks/useTripHistory";
import SchedulePanel from "@/components/SchedulePanel";
import CalendarView from "@/components/CalendarView";
import FloatingActionBar from "@/components/FloatingActionBar";

const TABS: { key: WorkspaceTab; label: string; icon: React.ElementType }[] = [
  { key: "trips", label: "Trips", icon: List },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "map", label: "Map", icon: Map },
];

interface WorkspaceStepProps {
  farms: Farm[];
  schedule: Schedule | null;
  prefs: InspectorPreferences;
  isComputing: boolean;
  travelPrefs: TravelPrefs;
  onPrefsChange: (prefs: InspectorPreferences) => void;
  onScheduleEdit: (edit: ScheduleEdit) => void;
}

function convertTripsToV3(schedule: Schedule): TripV3[] {
  return schedule.trips.map((trip) => ({
    ...trip,
    windowViolations: [],
    isUserEdited: false,
  }));
}

function computeScore(trips: TripV3[], totalFarms: number): ScheduleScore {
  const scheduledFarms = trips.reduce((s, t) => s + t.totalFarms, 0);
  const totalMiles = trips.reduce((s, t) => s + t.totalMiles, 0);
  const totalDriveMinutes = trips.reduce(
    (s, t) => s + t.days.reduce((ds, d) => ds + d.totalDriveMinutes, 0),
    0
  );
  const dayTrips = trips.filter((t) => t.tripType === "day_trip").length;
  const travelTrips = trips.filter((t) => t.tripType === "multi_day").length;
  const violationCount = trips.reduce((s, t) => s + t.windowViolations.length, 0);

  return {
    coveragePercent: totalFarms > 0 ? Math.round((scheduledFarms / totalFarms) * 100) : 0,
    totalEstimatedCost: trips.reduce((s, t) => s + t.estimatedTravelCost, 0),
    avgDriveTimeMinutes:
      trips.length > 0 ? Math.round(totalDriveMinutes / Math.max(1, trips.length)) : 0,
    totalTrips: trips.length,
    totalDayTrips: dayTrips,
    totalTravelTrips: travelTrips,
    windowViolationCount: violationCount,
  };
}

export default function WorkspaceStep({
  farms,
  schedule,
  prefs,
  isComputing,
  travelPrefs,
  onPrefsChange,
  onScheduleEdit,
}: WorkspaceStepProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("trips");
  const [selectedFarmIds, setSelectedFarmIds] = useState<Set<string>>(new Set());
  const [needsLocationFarms] = useState<Farm[]>(() =>
    farms.filter((f) => f.lat === 0 && f.lng === 0)
  );
  const [returnedFarms, setReturnedFarms] = useState<ReturnedFarm[]>([]);

  // Initialize trips from schedule
  const [trips, setTrips] = useState<TripV3[]>([]);
  const [history, setHistory] = useState<TripEditHistory | null>(null);

  // When schedule arrives (or changes), initialize trips + history
  useEffect(() => {
    if (schedule) {
      const v3Trips = convertTripsToV3(schedule);
      setTrips(v3Trips);
      const state = createTripState(v3Trips, needsLocationFarms, returnedFarms);
      setHistory(createInitialHistory(state));
    }
  }, [schedule, needsLocationFarms, returnedFarms]);

  const score = useMemo(() => computeScore(trips, farms.length), [trips, farms.length]);

  // Undo/redo handlers
  const handleUndo = useCallback(() => {
    if (!history) return;
    const result = undoHistory(history);
    if (result) {
      setHistory(result);
      setTrips(result.present.trips);
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    if (!history) return;
    const result = redoHistory(history);
    if (result) {
      setHistory(result);
      setTrips(result.present.trips);
    }
  }, [history]);

  // Keyboard shortcuts
  const attachKeys = useUndoRedoKeys(handleUndo, handleRedo);
  useEffect(() => {
    const cleanup = attachKeys();
    return cleanup;
  }, [attachKeys]);

  const canUndo = (history?.past.length ?? 0) > 0;
  const canRedo = (history?.future.length ?? 0) > 0;

  // Selection handlers
  const handleToggleFarm = useCallback((farmId: string) => {
    setSelectedFarmIds((prev) => {
      const next = new Set(prev);
      if (next.has(farmId)) {
        next.delete(farmId);
      } else {
        next.add(farmId);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedFarmIds(new Set());
  }, []);

  // Batch operation handlers (stubs — push edits via onScheduleEdit)
  const handleMoveFarms = useCallback((farmIds: string[], toTripId: string) => {
    onScheduleEdit({
      type: "move_farms",
      inspectionFarmId: farmIds[0],
      farmIds,
      toTripId,
    });
    setSelectedFarmIds(new Set());
  }, [onScheduleEdit]);

  const handleNewTrip = useCallback((farmIds: string[]) => {
    // For now, create a move_farms edit with no target — handled upstream
    onScheduleEdit({
      type: "move_farms",
      inspectionFarmId: farmIds[0],
      farmIds,
      toTripId: "__new__",
    });
    setSelectedFarmIds(new Set());
  }, [onScheduleEdit]);

  const handleReturnToSupervisor = useCallback((farmIds: string[], reason: string) => {
    const farmsToReturn = farms.filter((f) => farmIds.includes(f.id));
    setReturnedFarms((prev) => [
      ...prev,
      ...farmsToReturn.map((farm) => ({
        farm,
        reason,
        returnedAt: new Date().toISOString(),
      })),
    ]);
    // Remove from schedule
    for (const farmId of farmIds) {
      onScheduleEdit({
        type: "remove_inspection",
        inspectionFarmId: farmId,
      });
    }
    setSelectedFarmIds(new Set());
  }, [farms, onScheduleEdit]);

  if (!schedule && isComputing) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-primary-600/50">Generating schedule...</p>
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-earth-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
          <p className="text-sm">No schedule generated yet. Go back to set preferences.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab bar + undo/redo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-earth-100 rounded-[var(--radius-lg)] p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-earth-500 hover:text-earth-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 rounded-[var(--radius-md)] text-earth-500 hover:bg-earth-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-2 rounded-[var(--radius-md)] text-earth-500 hover:bg-earth-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-earth-50 rounded-[var(--radius-md)] border border-earth-200 text-xs text-earth-600">
        <span>
          <strong className="text-primary-700">{score.coveragePercent}%</strong> coverage
        </span>
        <span className="text-earth-300">|</span>
        <span>
          <strong className="text-primary-700">{score.totalTrips}</strong> trips
          ({score.totalDayTrips} day, {score.totalTravelTrips} travel)
        </span>
        <span className="text-earth-300">|</span>
        <span>
          ~<strong className="text-primary-700">${score.totalEstimatedCost.toLocaleString()}</strong> est. cost
        </span>
        {score.windowViolationCount > 0 && (
          <>
            <span className="text-earth-300">|</span>
            <span className="text-red-600 font-medium">
              {score.windowViolationCount} window violation{score.windowViolationCount !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {/* Needs Location bucket */}
      {needsLocationFarms.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-[var(--radius-md)]">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Needs Location ({needsLocationFarms.length})
            </span>
          </div>
          <div className="space-y-1">
            {needsLocationFarms.slice(0, 5).map((f) => (
              <div key={f.id} className="text-xs text-amber-700 pl-6">
                {f.name} — {f.address || "No address"}
              </div>
            ))}
            {needsLocationFarms.length > 5 && (
              <div className="text-xs text-amber-500 pl-6">
                +{needsLocationFarms.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="animate-fade-in-up">
        {activeTab === "trips" && (
          <SchedulePanel
            schedule={schedule}
            prefs={prefs}
            isComputing={isComputing}
            onEdit={onScheduleEdit}
            selectedFarmIds={selectedFarmIds}
            onToggleFarm={handleToggleFarm}
          />
        )}

        {activeTab === "calendar" && (
          <CalendarView schedule={schedule} />
        )}

        {activeTab === "map" && (
          <div className="flex items-center justify-center py-20 text-earth-400">
            <div className="text-center">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Map View</p>
              <p className="text-xs mt-1">Coming in Phase 5</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating action bar for batch operations */}
      <FloatingActionBar
        selectedFarmIds={selectedFarmIds}
        schedule={schedule}
        onMoveFarms={handleMoveFarms}
        onNewTrip={handleNewTrip}
        onReturnToSupervisor={handleReturnToSupervisor}
        onClearSelection={handleClearSelection}
      />

      {/* Returned farms bucket */}
      {returnedFarms.length > 0 && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-[var(--radius-md)]">
          <span className="text-sm font-medium text-red-800">
            Returned to Supervisor ({returnedFarms.length})
          </span>
          <div className="space-y-1 mt-2">
            {returnedFarms.map((rf) => (
              <div key={rf.farm.id} className="text-xs text-red-700 pl-2">
                {rf.farm.name} — {rf.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
