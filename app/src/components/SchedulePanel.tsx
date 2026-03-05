"use client";

import { useState, useCallback } from "react";
import {
  Download,
  CalendarDays,
  Route,
  Car,
  Tractor,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  Mail,
  Phone,
  FileText,
  AlertTriangle,
  Zap,
  Shield,
  FlaskConical,
  EyeOff,
  Hash,
  Copy,
  PhoneCall,
  Check,
  Home,
  ShieldAlert,
  X,
  CalendarOff,
  RefreshCw,
  List,
  Calendar,
} from "lucide-react";
import CalendarView from "@/components/CalendarView";
import {
  Schedule,
  Trip,
  TripDay,
  ScheduledInspection,
  InspectorPreferences,
  ScheduleEdit,
} from "@/lib/types";
import { scheduleToCSV } from "@/lib/scheduler";
import { generateContactScript } from "@/lib/contact-scripts";
import { format, parseISO } from "date-fns";

interface SchedulePanelProps {
  schedule: Schedule;
  prefs: InspectorPreferences;
  isComputing?: boolean;
  onEdit?: (edit: ScheduleEdit) => void;
}

export default function SchedulePanel({
  schedule,
  prefs,
  isComputing,
  onEdit,
}: SchedulePanelProps) {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
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

  // Split trips by type
  const dayTrips = schedule.trips.filter((t) => t.tripType === "day_trip");
  const travelTrips = schedule.trips.filter((t) => t.tripType === "multi_day");

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary-800">
              Your Inspection Schedule
            </h2>
            {isComputing && (
              <RefreshCw className="w-4 h-4 text-primary-400 animate-spin" />
            )}
          </div>
          <p className="text-sm text-primary-700/50 mt-1">
            {schedule.totalFarms} inspections across {schedule.totalTrips} trips
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
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* View toggle */}
          <div className="flex bg-earth-100 rounded-[var(--radius-md)] p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-[var(--radius-sm)] transition-all duration-200 cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-primary-500/40 hover:text-primary-600"
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 rounded-[var(--radius-sm)] transition-all duration-200 cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-primary-500/40 hover:text-primary-600"
              }`}
              title="Calendar view"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={exportCSV}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-[var(--radius-md)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Bento Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <BentoCard icon={Tractor} label="Inspections" value={schedule.totalFarms} accent="green" />
        <BentoCard icon={Route} label="Trips" value={schedule.totalTrips} accent="blue" />
        <BentoCard icon={Car} label="Total Miles" value={totalMiles.toLocaleString()} suffix="mi" accent="purple" />
        <BentoCard icon={CalendarDays} label="Days" value={totalDays} accent="gold" />
        <BentoCard icon={DollarSign} label="Est. Cost" value={`$${schedule.totalEstimatedCost.toLocaleString()}`} accent="green" />
      </div>

      {/* Warnings */}
      {schedule.certificationWarnings.length > 0 && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-[var(--radius-lg)] p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-purple-700 text-sm">Certification Mismatch</p>
              <ul className="text-xs text-purple-600 mt-1 space-y-0.5">
                {schedule.certificationWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {schedule.unscheduled.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-[var(--radius-lg)] p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-700 text-sm">
                {schedule.unscheduled.length} could not be scheduled
              </p>
              <ul className="mt-1 text-xs text-amber-600 space-y-0.5">
                {schedule.unscheduled.map((f) => (
                  <li key={f.id}>{f.name} — {f.city}, {f.state}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <CalendarView schedule={schedule} />
      )}

      {/* List view — Trip sections by type */}
      {viewMode === "list" && (
        <>
          {travelTrips.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Travel Trips
              </h3>
              <div className="space-y-3">
                {travelTrips.map((trip) => (
                  <TripSection
                    key={trip.id}
                    trip={trip}
                    prefs={prefs}
                    expanded={expandedTrips.has(trip.id)}
                    onToggle={() => toggleTrip(trip.id)}
                    onEdit={onEdit}
                    accentColor="blue"
                  />
                ))}
              </div>
            </div>
          )}

          {dayTrips.length > 0 && (
            <div>
              {travelTrips.length > 0 && (
                <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Day Trips
                </h3>
              )}
              <div className="space-y-3">
                {dayTrips.map((trip) => (
                  <TripSection
                    key={trip.id}
                    trip={trip}
                    prefs={prefs}
                    expanded={expandedTrips.has(trip.id)}
                    onToggle={() => toggleTrip(trip.id)}
                    onEdit={onEdit}
                    accentColor="emerald"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Fallback: show all trips unsorted if none have tripType set */}
          {travelTrips.length === 0 && dayTrips.length === 0 && (
            <div className="space-y-3">
              {schedule.trips.map((trip) => (
                <TripSection
                  key={trip.id}
                  trip={trip}
                  prefs={prefs}
                  expanded={expandedTrips.has(trip.id)}
                  onToggle={() => toggleTrip(trip.id)}
                  onEdit={onEdit}
                  accentColor="green"
                />
              ))}
            </div>
          )}
        </>
      )}
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
    <div className={`${a.bg} rounded-[var(--radius-lg)] p-3 ring-1 ${a.ring}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${a.icon}`} />
        <p className="text-[10px] font-bold text-primary-700/50 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold text-primary-800 font-[family-name:var(--font-display)]">
        {value}
        {suffix && <span className="text-xs font-normal text-primary-600/40 ml-0.5">{suffix}</span>}
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
  onEdit,
  accentColor,
}: {
  trip: Trip;
  prefs: InspectorPreferences;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: (edit: ScheduleEdit) => void;
  accentColor: string;
}) {
  const borderColor = accentColor === "blue" ? "border-blue-200" : accentColor === "emerald" ? "border-emerald-200" : "border-earth-200";
  const hoverBorder = accentColor === "blue" ? "hover:border-blue-300" : accentColor === "emerald" ? "hover:border-emerald-300" : "hover:border-earth-300";

  return (
    <div className={`bg-white border ${borderColor} ${hoverBorder} rounded-[var(--radius-xl)] overflow-hidden shadow-sm transition-colors duration-200`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary-50/30 transition-colors duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors duration-200 ${
            expanded ? "bg-primary-100 text-primary-600" : "bg-earth-100 text-earth-300"
          }`}>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
          <div className="text-left">
            <h3 className="font-[family-name:var(--font-display)] font-bold text-primary-800 text-sm">
              Trip {trip.tripNumber}
            </h3>
            <p className="text-xs text-primary-600/50 mt-0.5">
              {format(parseISO(trip.startDate), "MMM d")}
              {" \u2013 "}
              {format(parseISO(trip.endDate), "MMM d")}
              {" \u00B7 "}
              {trip.totalFarms} inspections
              {" \u00B7 "}
              {Math.round(trip.totalMiles)} mi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {trip.overnightsRequired > 0 && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full ring-1 ring-blue-100">
              {trip.overnightsRequired}N
            </span>
          )}
          <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full ring-1 ring-primary-100">
            {trip.days.length}d
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-earth-100">
          {trip.days.map((day, dayIdx) => (
            <DaySection
              key={day.date}
              day={day}
              dayIndex={dayIdx}
              isLastDay={dayIdx === trip.days.length - 1}
              prefs={prefs}
              onEdit={onEdit}
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
  onEdit,
}: {
  day: TripDay;
  dayIndex: number;
  isLastDay: boolean;
  prefs: InspectorPreferences;
  onEdit?: (edit: ScheduleEdit) => void;
}) {
  return (
    <div className={dayIndex > 0 ? "border-t border-earth-100" : ""}>
      <div className="px-4 py-2.5 bg-earth-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-full">
            {day.dayLabel}
          </span>
          <span className="text-xs text-primary-700/60">
            {format(parseISO(day.date), "EEE, MMM d")}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-primary-600/40">
          <span className="inline-flex items-center gap-1">
            <Car className="w-3 h-3" />
            {day.totalDriveMiles} mi
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {day.totalInspectionHours}h
          </span>
        </div>
      </div>

      {day.driveFromHomeMiles > 0 && (
        <div className="px-4 py-1.5 bg-blue-50/40">
          <span className="text-[10px] text-blue-600/60 inline-flex items-center gap-1">
            <Home className="w-2.5 h-2.5" />
            From home: {day.driveFromHomeMiles} mi, ~{formatMinutes(day.driveFromHomeMinutes)}
          </span>
        </div>
      )}

      <div className="divide-y divide-earth-100/60">
        {day.inspections.map((insp) => (
          <InspectionRow
            key={insp.farm.id}
            inspection={insp}
            prefs={prefs}
            onEdit={onEdit}
          />
        ))}
      </div>

      {isLastDay && day.driveToHomeMiles > 0 && (
        <div className="px-4 py-1.5 bg-blue-50/40 border-t border-earth-100/60">
          <span className="text-[10px] text-blue-600/60 inline-flex items-center gap-1">
            <Home className="w-2.5 h-2.5" />
            Return: {day.driveToHomeMiles} mi, ~{formatMinutes(day.driveToHomeMinutes)}
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

/* ── Inspection Row with Edit Controls ── */
function InspectionRow({
  inspection,
  prefs,
  onEdit,
}: {
  inspection: ScheduledInspection;
  prefs: InspectorPreferences;
  onEdit?: (edit: ScheduleEdit) => void;
}) {
  const { farm } = inspection;
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedCall, setCopiedCall] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const script = generateContactScript(inspection, prefs);

  const copyToClipboard = useCallback(
    async (text: string, type: "email" | "call") => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      if (type === "email") {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedCall(true);
        setTimeout(() => setCopiedCall(false), 2000);
      }
    },
    []
  );

  const handleMarkUnavailable = () => {
    if (onEdit) {
      onEdit({
        type: "mark_unavailable",
        inspectionFarmId: farm.id,
        unavailableDates: [inspection.date],
      });
    }
    setShowActions(false);
  };

  const handleRemove = () => {
    if (onEdit) {
      onEdit({
        type: "remove_inspection",
        inspectionFarmId: farm.id,
      });
    }
    setShowActions(false);
  };

  return (
    <div className="px-4 py-3 hover:bg-primary-50/20 transition-colors duration-150 group">
      {/* Drive chip */}
      {inspection.driveDistanceFromPrevMiles > 0 && (
        <div className="mb-1.5">
          <span className="text-[10px] text-primary-600/40 inline-flex items-center gap-1 bg-earth-50 px-2 py-0.5 rounded-full">
            <Car className="w-2.5 h-2.5" />
            {inspection.driveDistanceFromPrevMiles} mi · ~{inspection.driveTimeFromPrevMinutes} min
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        {/* Left: details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-[family-name:var(--font-display)] font-semibold text-primary-800 text-sm">
              {farm.name}
            </h4>
            {farm.priority === "urgent" && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full ring-1 ring-red-100">
                <Zap className="w-2.5 h-2.5" />
                URGENT
              </span>
            )}
            {farm.unannounced && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full ring-1 ring-purple-100">
                <EyeOff className="w-2.5 h-2.5" />
                UNANC.
              </span>
            )}
            {farm.samplingRequired && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full ring-1 ring-blue-100">
                <FlaskConical className="w-2.5 h-2.5" />
                SAMPLE
              </span>
            )}
          </div>

          {/* IDs */}
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-primary-600/35">
            {farm.nopId && (
              <span className="inline-flex items-center gap-0.5">
                <Hash className="w-2.5 h-2.5" />
                {farm.nopId}
              </span>
            )}
            {farm.auditNumber && <span>{farm.auditNumber}</span>}
          </div>

          {/* Time + Address */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-primary-700/50">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              {inspection.startTime} – {inspection.endTime}
            </span>
            {farm.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[200px]">{farm.address}</span>
              </span>
            )}
          </div>

          {/* Completion window */}
          {farm.completionFrom && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-primary-600/30">
              <CalendarDays className="w-2.5 h-2.5 shrink-0" />
              Window: {format(parseISO(farm.completionFrom), "MMM d")} – {farm.completionUntil ? format(parseISO(farm.completionUntil), "MMM d") : "?"}
            </div>
          )}

          {/* Contact */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-primary-700/35">
            {farm.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3 shrink-0" />
                {farm.email}
              </span>
            )}
            {farm.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3 shrink-0" />
                {farm.phone}
              </span>
            )}
          </div>

          {farm.notes && (
            <p className="mt-1.5 text-[10px] text-primary-600/30 inline-flex items-start gap-1">
              <FileText className="w-2.5 h-2.5 mt-0.5 shrink-0" />
              {farm.notes}
            </p>
          )}

          {/* Contact scripts + edit actions */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {script && (
              <>
                <button
                  onClick={() =>
                    copyToClipboard(`Subject: ${script.emailSubject}\n\n${script.emailBody}`, "email")
                  }
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer ${
                    copiedEmail
                      ? "bg-primary-100 text-primary-700"
                      : "bg-earth-100 text-primary-700/50 hover:bg-earth-200"
                  }`}
                >
                  {copiedEmail ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedEmail ? "Copied!" : "Email"}
                </button>
                <button
                  onClick={() => copyToClipboard(script.callScript, "call")}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer ${
                    copiedCall
                      ? "bg-primary-100 text-primary-700"
                      : "bg-earth-100 text-primary-700/50 hover:bg-earth-200"
                  }`}
                >
                  {copiedCall ? <Check className="w-2.5 h-2.5" /> : <PhoneCall className="w-2.5 h-2.5" />}
                  {copiedCall ? "Copied!" : "Call"}
                </button>
              </>
            )}

            {/* Edit action toggle */}
            {onEdit && (
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-[var(--radius-md)] bg-earth-50 text-primary-600/40 hover:bg-earth-100 hover:text-primary-600/60 transition-all duration-200 cursor-pointer"
                >
                  {showActions ? <X className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
                  Edit
                </button>
                {showActions && (
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-earth-200 rounded-[var(--radius-md)] shadow-lg py-1 min-w-[160px]">
                    <button
                      onClick={handleMarkUnavailable}
                      className="w-full px-3 py-1.5 text-left text-xs text-primary-700 hover:bg-primary-50 flex items-center gap-2 cursor-pointer"
                    >
                      <CalendarOff className="w-3 h-3 text-amber-500" />
                      Unavailable this date
                    </button>
                    <button
                      onClick={handleRemove}
                      className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      Remove from schedule
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: badges */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {farm.services.length > 0 && (
            <div className="flex flex-wrap gap-0.5 justify-end">
              {farm.services.map((svc) => (
                <span
                  key={svc}
                  className="text-[9px] font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded-full ring-1 ring-primary-100"
                >
                  {svc}
                </span>
              ))}
            </div>
          )}
          <span className="text-[10px] text-primary-600/40 font-medium">
            {farm.estimatedDurationHours}h est.
          </span>
        </div>
      </div>
    </div>
  );
}
