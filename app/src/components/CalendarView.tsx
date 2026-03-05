"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  parseISO,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Tractor,
  Car,
  MapPin,
  Clock,
  Zap,
  X,
} from "lucide-react";
import { Schedule, TripDay, ScheduledInspection } from "@/lib/types";

interface CalendarViewProps {
  schedule: Schedule;
}

interface DayData {
  date: Date;
  tripDays: { tripDay: TripDay; tripType: "day_trip" | "multi_day"; tripNumber: number }[];
}

export default function CalendarView({ schedule }: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  // Determine the month range from the schedule
  const initialMonth = useMemo(() => {
    if (schedule.dateRange.start) {
      return startOfMonth(parseISO(schedule.dateRange.start));
    }
    return startOfMonth(new Date());
  }, [schedule.dateRange.start]);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  // Build a map: date string -> array of trip days on that date
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData["tripDays"]>();
    for (const trip of schedule.trips) {
      for (const day of trip.days) {
        const key = day.date;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          tripDay: day,
          tripType: trip.tripType || "day_trip",
          tripNumber: trip.tripNumber,
        });
      }
    }
    return map;
  }, [schedule.trips]);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-1.5 rounded-[var(--radius-md)] hover:bg-earth-100 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-primary-600" />
        </button>
        <h3 className="font-[family-name:var(--font-display)] font-bold text-primary-800 text-lg">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-1.5 rounded-[var(--radius-md)] hover:bg-earth-100 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-primary-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-bold text-primary-600/40 uppercase tracking-wider py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-earth-200">
        {calendarDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const tripDays = dayMap.get(dateKey) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay.date);
          const totalInspections = tripDays.reduce(
            (s, td) => s + td.tripDay.inspections.length,
            0
          );
          const hasMultiDay = tripDays.some((td) => td.tripType === "multi_day");
          const hasDayTrip = tripDays.some((td) => td.tripType === "day_trip");

          return (
            <button
              key={dateKey}
              onClick={() => {
                if (tripDays.length > 0) {
                  setSelectedDay({ date: day, tripDays });
                } else {
                  setSelectedDay(null);
                }
              }}
              className={`
                relative border-r border-b border-earth-200 min-h-[60px] sm:min-h-[72px] p-1 text-left transition-all duration-150 cursor-pointer
                ${!inMonth ? "bg-earth-50/50" : "bg-white hover:bg-primary-50/30"}
                ${isSelected ? "ring-2 ring-primary-500 ring-inset z-10" : ""}
                ${today ? "bg-primary-50/40" : ""}
              `}
            >
              {/* Date number */}
              <span
                className={`text-xs font-medium block ${
                  !inMonth
                    ? "text-primary-600/20"
                    : today
                      ? "text-primary-700 font-bold"
                      : "text-primary-700/60"
                }`}
              >
                {format(day, "d")}
              </span>

              {/* Trip indicators */}
              {tripDays.length > 0 && inMonth && (
                <div className="mt-0.5 space-y-0.5">
                  {hasMultiDay && (
                    <div className="flex items-center gap-0.5">
                      <div className="w-full h-1.5 rounded-full bg-blue-400" />
                    </div>
                  )}
                  {hasDayTrip && (
                    <div className="flex items-center gap-0.5">
                      <div className="w-full h-1.5 rounded-full bg-emerald-400" />
                    </div>
                  )}
                  <span className="text-[9px] font-bold text-primary-700/60 block">
                    {totalInspections} insp.
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-primary-600/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-emerald-400" />
          Day Trip
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-blue-400" />
          Travel Trip
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedDay.tripDays.length > 0 && (
        <DayDetail
          dayData={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

/* ── Day Detail Panel ── */
function DayDetail({
  dayData,
  onClose,
}: {
  dayData: DayData;
  onClose: () => void;
}) {
  const allInspections: { inspection: ScheduledInspection; tripType: string; tripNumber: number }[] = [];
  for (const td of dayData.tripDays) {
    for (const insp of td.tripDay.inspections) {
      allInspections.push({
        inspection: insp,
        tripType: td.tripType,
        tripNumber: td.tripNumber,
      });
    }
  }

  const totalMiles = dayData.tripDays.reduce(
    (s, td) => s + td.tripDay.totalDriveMiles,
    0
  );

  return (
    <div className="mt-4 bg-white border border-earth-200 rounded-[var(--radius-xl)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary-50/50 border-b border-earth-100">
        <div>
          <h4 className="font-[family-name:var(--font-display)] font-bold text-primary-800 text-sm">
            {format(dayData.date, "EEEE, MMMM d")}
          </h4>
          <p className="text-[11px] text-primary-600/50 mt-0.5">
            {allInspections.length} inspection{allInspections.length !== 1 ? "s" : ""}
            {" \u00B7 "}
            {totalMiles} mi driving
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-[var(--radius-md)] hover:bg-earth-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4 text-primary-400" />
        </button>
      </div>

      {/* Inspections list */}
      <div className="divide-y divide-earth-100/60">
        {allInspections.map(({ inspection, tripType, tripNumber }) => (
          <div key={inspection.farm.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h5 className="font-semibold text-primary-800 text-sm">
                    {inspection.farm.name}
                  </h5>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      tripType === "multi_day"
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    }`}
                  >
                    Trip {tripNumber}
                  </span>
                  {inspection.farm.priority === "urgent" && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full ring-1 ring-red-100">
                      <Zap className="w-2.5 h-2.5" />
                      URGENT
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-primary-700/50">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {inspection.startTime} – {inspection.endTime}
                  </span>
                  {inspection.farm.address && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[200px]">{inspection.farm.address}</span>
                    </span>
                  )}
                  {inspection.driveDistanceFromPrevMiles > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Car className="w-3 h-3 shrink-0" />
                      {inspection.driveDistanceFromPrevMiles} mi
                    </span>
                  )}
                </div>

                {inspection.farm.services.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1.5">
                    {inspection.farm.services.map((svc) => (
                      <span
                        key={svc}
                        className="text-[9px] font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded-full ring-1 ring-primary-100"
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-[10px] text-primary-600/40 font-medium shrink-0">
                {inspection.farm.estimatedDurationHours}h
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
