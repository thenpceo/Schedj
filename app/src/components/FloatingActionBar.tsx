"use client";

import { useState, useMemo } from "react";
import {
  X,
  ArrowRight,
  Plus,
  UserX,
  ChevronDown,
} from "lucide-react";
import { Trip, Schedule } from "@/lib/types";

interface FloatingActionBarProps {
  selectedFarmIds: Set<string>;
  schedule: Schedule;
  onMoveFarms: (farmIds: string[], toTripId: string) => void;
  onNewTrip: (farmIds: string[]) => void;
  onReturnToSupervisor: (farmIds: string[], reason: string) => void;
  onClearSelection: () => void;
}

export default function FloatingActionBar({
  selectedFarmIds,
  schedule,
  onMoveFarms,
  onNewTrip,
  onReturnToSupervisor,
  onClearSelection,
}: FloatingActionBarProps) {
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");

  const count = selectedFarmIds.size;

  // Find which trips contain the selected farms
  const selectedFarmTripIds = useMemo(() => {
    const tripIds = new Set<string>();
    for (const trip of schedule.trips) {
      for (const day of trip.days) {
        for (const insp of day.inspections) {
          if (selectedFarmIds.has(insp.farm.id)) {
            tripIds.add(trip.id);
          }
        }
      }
    }
    return tripIds;
  }, [selectedFarmIds, schedule.trips]);

  // Trips to move to (exclude trips that already contain ALL selected farms)
  const moveTargets = useMemo(() => {
    return schedule.trips.filter((trip) => !selectedFarmTripIds.has(trip.id) || selectedFarmTripIds.size > 1);
  }, [schedule.trips, selectedFarmTripIds]);

  if (count === 0) return null;

  const farmIds = Array.from(selectedFarmIds);

  const handleMove = (tripId: string) => {
    onMoveFarms(farmIds, tripId);
    setShowMoveDropdown(false);
  };

  const handleNewTrip = () => {
    onNewTrip(farmIds);
  };

  const handleReturn = () => {
    if (!returnReason.trim()) return;
    onReturnToSupervisor(farmIds, returnReason.trim());
    setReturnReason("");
    setShowReturnDialog(false);
  };

  const tripLabel = (trip: Trip) => {
    const type = trip.tripType === "day_trip" ? "Day" : "Travel";
    return `Trip ${trip.tripNumber} — ${type} · ${trip.startDate}`;
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
      <div className="bg-white/95 backdrop-blur-xl border border-earth-200 rounded-[var(--radius-lg)] shadow-2xl shadow-earth-900/10 px-5 py-3 flex items-center gap-3">
        {/* Selection count */}
        <span className="text-sm font-semibold text-primary-800">
          {count} farm{count !== 1 ? "s" : ""} selected
        </span>

        <div className="w-px h-6 bg-earth-200" />

        {/* Move to Trip */}
        <div className="relative">
          <button
            onClick={() => {
              setShowMoveDropdown(!showMoveDropdown);
              setShowReturnDialog(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-md)] bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Move to Trip
            <ChevronDown className="w-3 h-3" />
          </button>

          {showMoveDropdown && (
            <div className="absolute bottom-full mb-2 left-0 w-64 bg-white border border-earth-200 rounded-[var(--radius-md)] shadow-xl py-1 max-h-48 overflow-y-auto">
              {moveTargets.length === 0 ? (
                <div className="px-3 py-2 text-xs text-earth-400">
                  No other trips available
                </div>
              ) : (
                moveTargets.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => handleMove(trip.id)}
                    className="w-full px-3 py-2 text-left text-xs text-primary-700 hover:bg-primary-50 cursor-pointer transition-colors"
                  >
                    <div className="font-medium">{tripLabel(trip)}</div>
                    <div className="text-primary-600/40 mt-0.5">
                      {trip.totalFarms} farms · {trip.totalMiles} mi
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* New Trip */}
        <button
          onClick={handleNewTrip}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-md)] bg-earth-50 text-earth-700 hover:bg-earth-100 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Trip
        </button>

        {/* Return to Supervisor */}
        <div className="relative">
          <button
            onClick={() => {
              setShowReturnDialog(!showReturnDialog);
              setShowMoveDropdown(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-md)] bg-red-50 text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <UserX className="w-3.5 h-3.5" />
            Return
          </button>

          {showReturnDialog && (
            <div className="absolute bottom-full mb-2 right-0 w-64 bg-white border border-earth-200 rounded-[var(--radius-md)] shadow-xl p-3">
              <label className="text-xs font-medium text-earth-700 block mb-1.5">
                Reason for returning
              </label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g., Too remote, scheduling conflict"
                className="w-full px-2.5 py-1.5 text-xs border border-earth-200 rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-primary-300"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleReturn();
                }}
                autoFocus
              />
              <button
                onClick={handleReturn}
                disabled={!returnReason.trim()}
                className="mt-2 w-full py-1.5 text-xs font-semibold bg-red-600 text-white rounded-[var(--radius-md)] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Confirm Return
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-earth-200" />

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-[var(--radius-md)] text-earth-400 hover:bg-earth-100 hover:text-earth-600 transition-colors cursor-pointer"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
