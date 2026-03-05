import { ScheduledInspection, InspectorPreferences, ContactScript } from "./types";
import { format, parseISO } from "date-fns";

export function generateContactScript(
  inspection: ScheduledInspection,
  prefs: InspectorPreferences
): ContactScript | null {
  const { farm } = inspection;

  // No contact scripts for unannounced inspections
  if (farm.unannounced) return null;

  const dateFormatted = format(parseISO(inspection.date), "EEEE, MMMM d, yyyy");
  const servicesFormatted = farm.services.join(", ");
  const durationFormatted =
    farm.estimatedDurationHours >= 1
      ? `${farm.estimatedDurationHours} hours`
      : `${Math.round(farm.estimatedDurationHours * 60)} minutes`;

  const inspectorLine = prefs.inspectorName || "Your assigned inspector";
  const inspectorContact = [
    prefs.inspectorEmail,
    prefs.inspectorPhone,
  ]
    .filter(Boolean)
    .join(" | ");

  // ── Email ──
  const emailSubject = `Organic Inspection Scheduling – ${farm.name} (${farm.auditNumber})`;

  const emailBody = `Dear ${farm.name},

I hope this message finds you well. I am writing to schedule your upcoming organic inspection.

PROPOSED INSPECTION DETAILS:
- Date: ${dateFormatted}
- Time: ${inspection.startTime} – ${inspection.endTime}
- Duration: approximately ${durationFormatted}
- Location: ${farm.address}
- Audit Number: ${farm.auditNumber}
- NOP ID: ${farm.nopId}
- Scope: ${servicesFormatted}
- Audit Type: ${farm.auditType}

WHAT TO PREPARE:
${buildPrepChecklist(farm.services)}

Please confirm this date and time works for you, or suggest an alternative within your inspection window${farm.completionFrom ? ` (${format(parseISO(farm.completionFrom), "MMM d")} – ${farm.completionUntil ? format(parseISO(farm.completionUntil), "MMM d, yyyy") : "TBD"})` : ""}.

Best regards,
${inspectorLine}${inspectorContact ? `\n${inspectorContact}` : ""}`;

  // ── Call Script ──
  const callScript = `CALL SCRIPT – ${farm.name}
Phone: ${farm.phone || farm.mobile || "N/A"}

"Hello, this is ${inspectorLine} calling regarding your organic inspection.

I'd like to schedule your ${farm.auditType.toLowerCase()} for ${dateFormatted} at ${inspection.startTime}.

The inspection will cover ${servicesFormatted} and should take approximately ${durationFormatted}.

${farm.samplingRequired ? "Please note: sampling will be required during this inspection.\n\n" : ""}Does that date and time work for you?"

KEY DETAILS:
- Audit #: ${farm.auditNumber}
- NOP ID: ${farm.nopId}
- Window: ${farm.completionFrom ? format(parseISO(farm.completionFrom), "MMM d") : "?"} – ${farm.completionUntil ? format(parseISO(farm.completionUntil), "MMM d, yyyy") : "?"}

IF CONFIRMED: Ask them to have ${buildPrepShortList(farm.services)} ready.
IF RESCHEDULE NEEDED: Note preferred dates and update schedule.`;

  return { emailSubject, emailBody, callScript };
}

function buildPrepChecklist(services: string[]): string {
  const items: string[] = [
    "- Organic System Plan (current version)",
    "- Purchase and sales records",
    "- Input materials list and labels",
    "- Field/production records",
  ];

  const serviceSet = new Set(services.map((s) => s.toLowerCase()));

  if (serviceSet.has("nop crop")) {
    items.push("- Field maps and planting records");
    items.push("- Seed/transplant purchase records");
    items.push("- Pest management records");
  }

  if (serviceSet.has("nop handling")) {
    items.push("- Product labels and ingredient lists");
    items.push("- Supplier organic certificates");
    items.push("- Processing/handling records");
    items.push("- Pest management logs for facility");
  }

  if (serviceSet.has("nop livestock")) {
    items.push("- Livestock health records");
    items.push("- Feed purchase records and rations");
    items.push("- Pasture/outdoor access records");
  }

  return items.join("\n");
}

function buildPrepShortList(services: string[]): string {
  const items = [
    "organic system plan",
    "purchase/sales records",
    "input materials",
  ];

  const serviceSet = new Set(services.map((s) => s.toLowerCase()));

  if (serviceSet.has("nop crop")) {
    items.push("field maps");
  }
  if (serviceSet.has("nop handling")) {
    items.push("product labels and supplier certificates");
  }
  if (serviceSet.has("nop livestock")) {
    items.push("livestock health and feed records");
  }

  return items.join(", ");
}
