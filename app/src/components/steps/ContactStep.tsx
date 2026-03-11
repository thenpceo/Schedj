"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Mail,
  Phone,
  CheckCircle2,
  Loader2,
  Play,
  Users,
  ArrowLeft,
  X,
} from "lucide-react";
import { Schedule, ScheduledInspection } from "@/lib/types";

interface ContactStepProps {
  schedule: Schedule | null;
  onBack: () => void;
}

interface ContactEntry {
  farmName: string;
  farmId: string;
  date: string;
  email: string;
  status: "pending" | "sending" | "sent" | "failed";
}

export default function ContactStep({ schedule, onBack }: ContactStepProps) {
  const [entries, setEntries] = useState<ContactEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [previewFarmId, setPreviewFarmId] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Build contact list from schedule
  useEffect(() => {
    if (!schedule) return;
    const list: ContactEntry[] = [];
    for (const trip of schedule.trips) {
      for (const day of trip.days) {
        for (const insp of day.inspections) {
          list.push({
            farmName: insp.farm.name,
            farmId: insp.farm.id,
            date: insp.date,
            email: insp.farm.email || "no-email@placeholder.com",
            status: "pending",
          });
        }
      }
    }
    setEntries(list);
  }, [schedule]);

  const runSimulation = useCallback(async () => {
    setIsRunning(true);
    setIsComplete(false);
    abortRef.current = false;

    for (let i = 0; i < entries.length; i++) {
      if (abortRef.current) break;

      // Mark as sending
      setEntries((prev) =>
        prev.map((e, idx) => (idx === i ? { ...e, status: "sending" } : e))
      );

      // Simulate delay
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));

      if (abortRef.current) break;

      // Mark as sent (with small chance of "failed" for realism)
      const success = Math.random() > 0.05;
      setEntries((prev) =>
        prev.map((e, idx) =>
          idx === i ? { ...e, status: success ? "sent" : "failed" } : e
        )
      );
    }

    setIsRunning(false);
    setIsComplete(true);
  }, [entries.length]);

  const sentCount = entries.filter((e) => e.status === "sent").length;
  const failedCount = entries.filter((e) => e.status === "failed").length;
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  if (!schedule || entries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Users className="w-12 h-12 text-earth-300 mx-auto mb-3" />
        <p className="text-sm text-earth-500">No scheduled farms to contact.</p>
        <button
          onClick={onBack}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Demo badge */}
      <div className="mb-4 flex items-center justify-center">
        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase tracking-wider">
          Demo Mode
        </span>
      </div>

      <h2 className="text-lg font-semibold text-primary-800 text-center mb-2">
        Contact the Farms
      </h2>
      <p className="text-sm text-earth-500 text-center mb-6">
        Simulated AI agent sending inspection notifications to {entries.length} farms
      </p>

      {/* Start button */}
      {!isRunning && !isComplete && (
        <button
          onClick={runSimulation}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-[var(--radius-lg)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          Start Contacting Farms
        </button>
      )}

      {/* Summary (shown during + after) */}
      {(isRunning || isComplete) && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="bg-primary-50 rounded-[var(--radius-md)] p-3 text-center">
            <div className="text-2xl font-bold text-primary-700">{sentCount}</div>
            <div className="text-xs text-primary-500">Contacted</div>
          </div>
          <div className="bg-red-50 rounded-[var(--radius-md)] p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
            <div className="text-xs text-red-400">Failed</div>
          </div>
          <div className="bg-earth-50 rounded-[var(--radius-md)] p-3 text-center">
            <div className="text-2xl font-bold text-earth-600">{pendingCount}</div>
            <div className="text-xs text-earth-400">Pending</div>
          </div>
        </div>
      )}

      {/* Email preview */}
      {previewFarmId && (() => {
        const entry = entries.find((e) => e.farmId === previewFarmId);
        if (!entry) return null;
        return (
          <div className="mb-4 bg-white border border-earth-200 rounded-[var(--radius-lg)] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-earth-50 border-b border-earth-100">
              <span className="text-xs font-semibold text-earth-600">Email Preview</span>
              <button onClick={() => setPreviewFarmId(null)} className="text-earth-400 hover:text-earth-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-2 text-xs">
              <div><span className="text-earth-400">To:</span> <span className="text-earth-700">{entry.email}</span></div>
              <div><span className="text-earth-400">Subject:</span> <span className="text-earth-700 font-medium">Organic Inspection Scheduled — {entry.farmName}</span></div>
              <div className="pt-2 border-t border-earth-100 text-earth-600 leading-relaxed">
                <p>Dear {entry.farmName},</p>
                <p className="mt-2">Your organic inspection has been scheduled for <strong>{entry.date}</strong>. Please confirm your availability at your earliest convenience.</p>
                <p className="mt-2">Please have the following items prepared:</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Updated Organic System Plan (OSP)</li>
                  <li>Input purchase records</li>
                  <li>Sales and transaction records</li>
                  <li>Field maps and buffer zone documentation</li>
                </ul>
                <p className="mt-2">Best regards,<br />SCHEDJ Inspection Scheduling</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Farm contact list */}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.farmId}
            onClick={() => entry.status === "sent" ? setPreviewFarmId(entry.farmId === previewFarmId ? null : entry.farmId) : undefined}
            className={`flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] border transition-all duration-300 ${
              entry.status === "sending"
                ? "bg-primary-50 border-primary-200"
                : entry.status === "sent"
                  ? "bg-green-50 border-green-200 cursor-pointer hover:bg-green-100/50"
                  : entry.status === "failed"
                    ? "bg-red-50 border-red-200"
                    : "bg-white border-earth-200"
            }`}
          >
            {/* Status icon */}
            <div className="w-6 h-6 flex items-center justify-center">
              {entry.status === "sending" && (
                <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
              )}
              {entry.status === "sent" && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              {entry.status === "failed" && (
                <Mail className="w-4 h-4 text-red-400" />
              )}
              {entry.status === "pending" && (
                <Mail className="w-4 h-4 text-earth-300" />
              )}
            </div>

            {/* Farm info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-earth-800 truncate">
                {entry.farmName}
              </div>
              <div className="text-xs text-earth-400 truncate">
                {entry.email} &middot; {entry.date}
              </div>
            </div>

            {/* Status label */}
            <span
              className={`text-xs font-medium ${
                entry.status === "sending"
                  ? "text-primary-600"
                  : entry.status === "sent"
                    ? "text-green-600"
                    : entry.status === "failed"
                      ? "text-red-500"
                      : "text-earth-300"
              }`}
            >
              {entry.status === "sending"
                ? "Sending..."
                : entry.status === "sent"
                  ? "Sent"
                  : entry.status === "failed"
                    ? "Failed"
                    : "Pending"}
            </span>
          </div>
        ))}
      </div>

      {/* Complete message */}
      {isComplete && (
        <div className="mt-6 p-4 bg-primary-50 rounded-[var(--radius-lg)] border border-primary-100 text-center">
          <CheckCircle2 className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-primary-700">
            Contact simulation complete
          </p>
          <p className="text-xs text-primary-500 mt-1">
            {sentCount} farms contacted, {failedCount} failed, {pendingCount} pending
          </p>
        </div>
      )}
    </div>
  );
}
