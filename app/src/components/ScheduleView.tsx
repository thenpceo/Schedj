"use client";

import { useState, useCallback } from "react";
import {
  MapPin,
  Clock,
  Car,
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileText,
  Download,
  CalendarDays,
  Route,
  Tractor,
  Zap,
  Shield,
  FlaskConical,
  EyeOff,
  Hash,
  DollarSign,
  Copy,
  PhoneCall,
  Check,
  Home,
} from "lucide-react";
import { Schedule, Trip, TripDay, ScheduledInspection, InspectorPreferences } from "@/lib/types";
import { scheduleToCSV } from "@/lib/scheduler";
import { generateContactScript } from "@/lib/contact-scripts";
import { getAgencyColor } from "@/lib/agency-colors";
import { format, parseISO } from "date-fns";

interface ScheduleViewProps {
  schedule: Schedule;
  prefs: InspectorPreferences;
}

export default function ScheduleView({ schedule, prefs }: ScheduleViewProps) {
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(
    new Set(schedule.trips.map((t) => t.id))
  );

  const toggleTrip = (tripId: string) => {
    setExpandedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  };

  const exportCSV = () => {
    const csv = scheduleToCSV(schedule, prefs);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inspection-schedule-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalMiles = Math.round(
    schedule.trips.reduce((s, t) => s + t.totalMiles, 0)
  );
  const totalDays = schedule.trips.reduce((s, t) => s + t.days.length, 0);

  // Check if farms come from multiple agencies
  const allAgencies = new Set<string>();
  for (const trip of schedule.trips) {
    for (const day of trip.days) {
      for (const insp of day.inspections) {
        if (insp.farm.sourceAgency) allAgencies.add(insp.farm.sourceAgency);
      }
    }
  }
  const isMultiAgency = allAgencies.size >= 2;

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-primary-800 mb-1.5">
            Your Inspection Schedule
          </h2>
          <p className="text-sm text-primary-700/50">
            {schedule.totalFarms} inspections scheduled across {schedule.totalTrips} trips
            {schedule.dateRange.start && (
              <>
                {" \u00B7 "}
                {format(parseISO(schedule.dateRange.start), "MMM d")}
                {" \u2013 "}
                {format(parseISO(schedule.dateRange.end), "MMM d, yyyy")}
              </>
            )}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-[var(--radius-md)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98] flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* ── Bento Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8 stagger-children">
        <BentoCard
          icon={Tractor}
          label="Inspections"
          value={schedule.totalFarms}
          accent="green"
        />
        <BentoCard
          icon={Route}
          label="Trips"
          value={schedule.totalTrips}
          accent="blue"
        />
        <BentoCard
          icon={Car}
          label="Total Miles"
          value={totalMiles.toLocaleString()}
          suffix="mi"
          accent="purple"
        />
        <BentoCard
          icon={CalendarDays}
          label="Inspection Days"
          value={totalDays}
          accent="gold"
        />
        <BentoCard
          icon={DollarSign}
          label="Est. Travel Cost"
          value={`$${schedule.totalEstimatedCost.toLocaleString()}`}
          accent="green"
        />
      </div>


      {/* ── Forfeited Deadlines Warning ── */}
      {schedule.forfeited && schedule.forfeited.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-[var(--radius-xl)] p-4 sm:p-5 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700 text-sm">
                {schedule.forfeited.length} deadline(s) cannot be met
              </p>
              <ul className="mt-1.5 text-sm text-red-600 space-y-1">
                {schedule.forfeited.map((ff) => (
                  <li key={ff.farm.id}>
                    <span className="font-medium">{ff.farm.name}</span>
                    {" — "}{ff.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Unscheduled Warning ── */}
      {schedule.unscheduled.length > 0 && (
        <div className="mb-6 bg-gold-50 border border-gold-200 rounded-[var(--radius-xl)] p-4 sm:p-5 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-gold-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gold-700 text-sm">
                {schedule.unscheduled.length} operation(s) could not be scheduled
              </p>
              <ul className="mt-1.5 text-sm text-gold-600 space-y-0.5">
                {schedule.unscheduled.map((f) => (
                  <li key={f.id}>
                    {f.name}
                    {f.nopId && <span className="text-gold-500"> ({f.nopId})</span>}
                    {" \u2014 "}{f.city}, {f.state}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Trips ── */}
      <div className="space-y-4">
        {schedule.trips.map((trip) => (
          <TripSection
            key={trip.id}
            trip={trip}
            prefs={prefs}
            expanded={expandedTrips.has(trip.id)}
            onToggle={() => toggleTrip(trip.id)}
            isMultiAgency={isMultiAgency}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Bento Card ── */
function BentoCard({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  suffix?: string;
  accent: string;
}) {
  const accents: Record<string, { bg: string; icon: string; ring: string }> = {
    green: { bg: "bg-primary-50", icon: "text-primary-500", ring: "ring-primary-100" },
    blue: { bg: "bg-blue-50", icon: "text-blue-500", ring: "ring-blue-100" },
    purple: { bg: "bg-purple-50", icon: "text-purple-500", ring: "ring-purple-100" },
    gold: { bg: "bg-gold-50", icon: "text-gold-500", ring: "ring-gold-100" },
  };

  const a = accents[accent] || accents.green;

  return (
    <div className={`${a.bg} rounded-[var(--radius-xl)] p-4 sm:p-5 ring-1 ${a.ring} animate-fade-in-up`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${a.icon}`} />
        <p className="text-[11px] font-bold text-primary-700/50 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-primary-800 font-[family-name:var(--font-display)]">
        {value}
        {suffix && (
          <span className="text-sm font-normal text-primary-600/40 ml-1">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

/* ── Trip Section ── */
function TripSection({
  trip,
  prefs,
  expanded,
  onToggle,
  isMultiAgency,
}: {
  trip: Trip;
  prefs: InspectorPreferences;
  expanded: boolean;
  onToggle: () => void;
  isMultiAgency: boolean;
}) {
  return (
    <div className="bg-white border border-earth-200 rounded-[var(--radius-xl)] overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-primary-50/30 transition-colors duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors duration-200 ${
            expanded ? "bg-primary-100 text-primary-600" : "bg-earth-100 text-earth-300"
          }`}>
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-[family-name:var(--font-display)] font-bold text-primary-800">
              Trip {trip.tripNumber}
            </h3>
            <p className="text-xs sm:text-sm text-primary-600/50 mt-0.5">
              {format(parseISO(trip.startDate), "MMM d")}
              {" \u2013 "}
              {format(parseISO(trip.endDate), "MMM d")}
              {" \u00B7 "}
              {trip.totalFarms} inspections
              {" \u00B7 "}
              {Math.round(trip.totalMiles)} mi
              {" \u00B7 "}
              <span className="text-primary-600/40">~${trip.estimatedTravelCost.toLocaleString()}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trip.overnightsRequired > 0 && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-100 hidden sm:inline">
              {trip.overnightsRequired} night{trip.overnightsRequired > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full ring-1 ring-primary-100 hidden sm:inline">
            {trip.days.length} {trip.days.length === 1 ? "day" : "days"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-earth-100 animate-slide-down">
          {trip.days.map((day, dayIdx) => (
            <DaySection
              key={day.date}
              day={day}
              dayIndex={dayIdx}
              isLastDay={dayIdx === trip.days.length - 1}
              prefs={prefs}
              isMultiAgency={isMultiAgency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Day Section ── */
function DaySection({
  day,
  dayIndex,
  isLastDay,
  prefs,
  isMultiAgency,
}: {
  day: TripDay;
  dayIndex: number;
  isLastDay: boolean;
  prefs: InspectorPreferences;
  isMultiAgency: boolean;
}) {
  return (
    <div className={dayIndex > 0 ? "border-t border-earth-100" : ""}>
      <div className="px-4 sm:px-6 py-3 bg-earth-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
            {day.dayLabel}
          </span>
          <span className="text-sm text-primary-700/60">
            {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-primary-600/40">
          <span className="inline-flex items-center gap-1">
            <Car className="w-3 h-3" />
            {day.totalDriveMiles} mi
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {day.totalInspectionHours}h inspections
          </span>
        </div>
      </div>

      {/* Drive from home annotation */}
      {day.driveFromHomeMiles > 0 && (
        <div className="px-4 sm:px-6 py-2 bg-blue-50/40">
          <span className="text-[11px] text-blue-600/60 inline-flex items-center gap-1.5">
            <Home className="w-3 h-3" />
            Drive from home: {day.driveFromHomeMiles} mi, ~{formatMinutes(day.driveFromHomeMinutes)}
          </span>
        </div>
      )}

      <div className="divide-y divide-earth-100/60">
        {day.inspections.map((insp, idx) => (
          <InspectionRow key={insp.farm.id} inspection={insp} index={idx} prefs={prefs} isMultiAgency={isMultiAgency} />
        ))}
      </div>

      {/* Return to home annotation (last day) */}
      {isLastDay && day.driveToHomeMiles > 0 && (
        <div className="px-4 sm:px-6 py-2 bg-blue-50/40 border-t border-earth-100/60">
          <span className="text-[11px] text-blue-600/60 inline-flex items-center gap-1.5">
            <Home className="w-3 h-3" />
            Return home: {day.driveToHomeMiles} mi, ~{formatMinutes(day.driveToHomeMinutes)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── Inspection Row ── */
function InspectionRow({
  inspection,
  prefs,
  isMultiAgency,
}: {
  inspection: ScheduledInspection;
  index: number;
  prefs: InspectorPreferences;
  isMultiAgency: boolean;
}) {
  const { farm } = inspection;
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedCall, setCopiedCall] = useState(false);

  const script = generateContactScript(inspection, prefs);

  const copyToClipboard = useCallback(
    async (text: string, type: "email" | "call") => {
      try {
        await navigator.clipboard.writeText(text);
        if (type === "email") {
          setCopiedEmail(true);
          setTimeout(() => setCopiedEmail(false), 2000);
        } else {
          setCopiedCall(true);
          setTimeout(() => setCopiedCall(false), 2000);
        }
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        if (type === "email") {
          setCopiedEmail(true);
          setTimeout(() => setCopiedEmail(false), 2000);
        } else {
          setCopiedCall(true);
          setTimeout(() => setCopiedCall(false), 2000);
        }
      }
    },
    []
  );

  return (
    <div className="px-4 sm:px-6 py-4 hover:bg-primary-50/20 transition-colors duration-150">
      {/* Drive chip */}
      {inspection.driveDistanceFromPrevMiles > 0 && (
        <div className="mb-2">
          <span className="text-[11px] text-primary-600/40 inline-flex items-center gap-1.5 bg-earth-50 px-2.5 py-1 rounded-full">
            <Car className="w-3 h-3" />
            {inspection.driveDistanceFromPrevMiles} mi drive
            {" \u00B7 "}
            ~{inspection.driveTimeFromPrevMinutes} min
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Left: details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-[family-name:var(--font-display)] font-semibold text-primary-800 text-base">
              {farm.name}
            </h4>
            {isMultiAgency && farm.sourceAgency && (
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${getAgencyColor(farm.sourceAgency)}`}>
                {farm.sourceAgency}
              </span>
            )}
            {farm.priority === "urgent" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full ring-1 ring-red-100">
                <Zap className="w-3 h-3" />
                URGENT
              </span>
            )}
            {farm.unannounced && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full ring-1 ring-purple-100">
                <EyeOff className="w-3 h-3" />
                UNANNOUNCED
              </span>
            )}
            {farm.samplingRequired && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-100">
                <FlaskConical className="w-3 h-3" />
                SAMPLING
              </span>
            )}
          </div>

          {/* IDs row */}
          <div className="flex items-center gap-3 mt-1 text-xs text-primary-600/40">
            {farm.nopId && (
              <span className="inline-flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {farm.nopId}
              </span>
            )}
            {farm.auditNumber && (
              <span>{farm.auditNumber}</span>
            )}
            {farm.auditType && (
              <span className="text-primary-600/30">{farm.auditType}</span>
            )}
          </div>

          {/* Time + Address */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm text-primary-700/50">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              {inspection.startTime} &ndash; {inspection.endTime}
            </span>
            {farm.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-[220px] sm:max-w-none">{farm.address}</span>
              </span>
            )}
          </div>

          {/* Completion window */}
          {(farm.completionFrom || farm.completionUntil) && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-primary-600/35">
              <CalendarDays className="w-3 h-3 flex-shrink-0" />
              <span>
                Window: {farm.completionFrom ? format(parseISO(farm.completionFrom), "MMM d") : "?"} &ndash; {farm.completionUntil ? format(parseISO(farm.completionUntil), "MMM d, yyyy") : "?"}
              </span>
            </div>
          )}

          {/* Contact row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5 text-sm text-primary-700/40">
            {farm.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-none">{farm.email}</span>
              </span>
            )}
            {farm.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                {farm.phone}
              </span>
            )}
          </div>

          {farm.notes && (
            <p className="mt-2 text-xs text-primary-600/35 inline-flex items-start gap-1.5">
              <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {farm.notes}
            </p>
          )}

          {/* Contact script buttons */}
          {script && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() =>
                  copyToClipboard(
                    `Subject: ${script.emailSubject}\n\n${script.emailBody}`,
                    "email"
                  )
                }
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer ${
                  copiedEmail
                    ? "bg-primary-100 text-primary-700 ring-1 ring-primary-200"
                    : "bg-earth-100 text-primary-700/50 hover:bg-earth-200 hover:text-primary-700"
                }`}
              >
                {copiedEmail ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copiedEmail ? "Copied!" : "Copy Email"}
              </button>
              <button
                onClick={() =>
                  copyToClipboard(script.callScript, "call")
                }
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer ${
                  copiedCall
                    ? "bg-primary-100 text-primary-700 ring-1 ring-primary-200"
                    : "bg-earth-100 text-primary-700/50 hover:bg-earth-200 hover:text-primary-700"
                }`}
              >
                {copiedCall ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <PhoneCall className="w-3 h-3" />
                )}
                {copiedCall ? "Copied!" : "Copy Call Script"}
              </button>
            </div>
          )}
        </div>

        {/* Right: badges */}
        <div className="flex sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
          {farm.services.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:justify-end">
              {farm.services.map((svc) => (
                <span
                  key={svc}
                  className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full ring-1 ring-primary-100"
                >
                  {svc}
                </span>
              ))}
            </div>
          )}
          <span className="text-[11px] text-primary-600/40 font-medium">
            {farm.estimatedDurationHours}h est.
          </span>
          <ContactStatusBadge status={inspection.contactStatus} />
        </div>
      </div>
    </div>
  );
}

/* ── Contact Status Badge ── */
function ContactStatusBadge({
  status,
}: {
  status: ScheduledInspection["contactStatus"];
}) {
  const styles: Record<string, string> = {
    not_contacted: "bg-earth-100 text-earth-300 ring-earth-200",
    emailed: "bg-blue-50 text-blue-600 ring-blue-100",
    called: "bg-purple-50 text-purple-600 ring-purple-100",
    confirmed: "bg-primary-50 text-primary-700 ring-primary-100",
  };

  const labels: Record<string, string> = {
    not_contacted: "Not contacted",
    emailed: "Emailed",
    called: "Called",
    confirmed: "Confirmed",
  };

  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
