// ── Agency badge color utility ──

const AGENCY_COLORS: Record<string, string> = {
  PCO: "bg-blue-100 text-blue-700 border-blue-200",
  CCOF: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SAMPLE: "bg-purple-100 text-purple-700 border-purple-200",
};

const FALLBACK_PALETTE = [
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
];

export function getAgencyColor(agency: string): string {
  if (AGENCY_COLORS[agency]) return AGENCY_COLORS[agency];
  const hash = agency.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}
