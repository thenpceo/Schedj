"use client";

import { useCallback, useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  Download,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Zap,
  X,
} from "lucide-react";
import { Farm } from "@/lib/types";
import { parseFile, generateCSVTemplate, DetectedFormat } from "@/lib/parser";
import { SAMPLE_FARMS } from "@/lib/sample-data";
import { getAgencyColor } from "@/lib/agency-colors";

interface UploadedFile {
  id: string;
  fileName: string;
  agency: string;
  farms: Farm[];
  skipped: Farm[];
  errors: string[];
  detectedFormat: DetectedFormat;
}

interface FileUploadProps {
  onFarmsLoaded: (farms: Farm[], skipped: Farm[]) => void;
}

// ── Agency auto-detection ──
function detectAgencyFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("pco")) return "PCO";
  if (lower.includes("ccof")) return "CCOF";
  return null;
}

function detectAgencyFromFormat(format: DetectedFormat, headers?: string[]): string | null {
  if (format === "intact") return "PCO"; // Intact standard = PCO default
  if (format === "ccof") return "CCOF";
  return null;
}

let agencyCounter = 0;
function nextAutoAgency(): string {
  agencyCounter += 1;
  return `Agency ${agencyCounter}`;
}

export default function FileUpload({ onFarmsLoaded }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived totals
  const totalFarms = uploadedFiles.reduce((sum, f) => sum + f.farms.length, 0);
  const totalSkipped = uploadedFiles.reduce((sum, f) => sum + f.skipped.length, 0);
  const totalUrgent = uploadedFiles.reduce(
    (sum, f) => sum + f.farms.filter((farm) => farm.priority === "urgent").length,
    0
  );
  const uniqueAgencies = [...new Set(uploadedFiles.map((f) => f.agency))];

  // Merge all farms with prefixed IDs and call parent
  const mergeAndNotify = useCallback(
    (files: UploadedFile[]) => {
      const allFarms: Farm[] = [];
      const allSkipped: Farm[] = [];

      for (const uf of files) {
        for (let i = 0; i < uf.farms.length; i++) {
          allFarms.push({
            ...uf.farms[i],
            id: `${uf.agency}-farm-${i + 1}`,
            sourceAgency: uf.agency,
          });
        }
        for (let i = 0; i < uf.skipped.length; i++) {
          allSkipped.push({
            ...uf.skipped[i],
            id: `${uf.agency}-skipped-${i + 1}`,
            sourceAgency: uf.agency,
          });
        }
      }

      onFarmsLoaded(allFarms, allSkipped);
    },
    [onFarmsLoaded]
  );

  const handleSingleFile = useCallback(
    (file: File) => {
      // File size guard: reject >50MB
      if (file.size > 50 * 1024 * 1024) {
        setUploadedFiles((prev) => {
          const updated = [
            ...prev,
            {
              id: `file-${Date.now()}`,
              fileName: file.name,
              agency: "Unknown",
              farms: [],
              skipped: [],
              errors: [`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`],
              detectedFormat: "generic" as DetectedFormat,
            },
          ];
          return updated;
        });
        return;
      }

      setParsing(true);
      const reader = new FileReader();

      reader.onload = (e) => {
        const result = e.target?.result;
        if (!result) {
          setParsing(false);
          return;
        }

        // Detect agency from filename first
        let agency = detectAgencyFromFilename(file.name);

        const parsed = parseFile(result as ArrayBuffer, file.name, agency || undefined);

        // If filename didn't detect agency, try from format
        if (!agency) {
          agency = detectAgencyFromFormat(parsed.detectedFormat);
        }

        // Fallback: auto-assign
        if (!agency) {
          agency = nextAutoAgency();
        }

        // Stamp agency on all farms
        for (const farm of parsed.farms) {
          farm.sourceAgency = agency;
        }
        for (const farm of parsed.skipped) {
          farm.sourceAgency = agency;
        }

        const newEntry: UploadedFile = {
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          agency,
          farms: parsed.farms,
          skipped: parsed.skipped,
          errors: parsed.errors,
          detectedFormat: parsed.detectedFormat,
        };

        // Zero-farm guard
        if (parsed.farms.length === 0 && parsed.errors.length === 0) {
          newEntry.errors.push(`No inspections found in "${file.name}".`);
        }

        setUploadedFiles((prev) => {
          // Replace existing entry with same filename
          const existing = prev.findIndex((f) => f.fileName === file.name);
          let updated: UploadedFile[];
          if (existing >= 0) {
            updated = [...prev];
            updated[existing] = newEntry;
          } else {
            updated = [...prev, newEntry];
          }
          // Merge and notify after state update
          setTimeout(() => mergeAndNotify(updated), 0);
          return updated;
        });

        setParsing(false);
      };

      reader.onerror = () => {
        setParsing(false);
      };

      reader.readAsArrayBuffer(file);
    },
    [mergeAndNotify]
  );

  const handleFiles = useCallback(
    (files: FileList) => {
      for (let i = 0; i < files.length; i++) {
        handleSingleFile(files[i]);
      }
    },
    [handleSingleFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // Reset input so same file can be re-uploaded
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeFile = useCallback(
    (fileId: string) => {
      setUploadedFiles((prev) => {
        const updated = prev.filter((f) => f.id !== fileId);
        setTimeout(() => mergeAndNotify(updated), 0);
        return updated;
      });
    },
    [mergeAndNotify]
  );

  const loadSample = useCallback(() => {
    setParsing(true);
    setTimeout(() => {
      const farms = SAMPLE_FARMS.filter((f) => f.priority !== "do_not_inspect");
      const skipped = SAMPLE_FARMS.filter((f) => f.priority === "do_not_inspect");

      const sampleEntry: UploadedFile = {
        id: "sample-data",
        fileName: "Sample Data",
        agency: "SAMPLE",
        farms,
        skipped,
        errors: [],
        detectedFormat: "intact",
      };

      setUploadedFiles((prev) => {
        // Replace existing sample entry if present
        const existing = prev.findIndex((f) => f.id === "sample-data");
        let updated: UploadedFile[];
        if (existing >= 0) {
          updated = [...prev];
          updated[existing] = sampleEntry;
        } else {
          updated = [...prev, sampleEntry];
        }
        setTimeout(() => mergeAndNotify(updated), 0);
        return updated;
      });
      setParsing(false);
    }, 600);
  }, [mergeAndNotify]);

  const downloadTemplate = useCallback(() => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inspection-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const hasFiles = uploadedFiles.length > 0;
  const allErrors = uploadedFiles.flatMap((f) => f.errors);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10">
        <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-primary-800 mb-3">
          Upload Your Inspection List
        </h2>
        <p className="text-sm sm:text-base text-primary-700/60 max-w-md mx-auto leading-relaxed">
          Upload Intact Platform exports (.xls/.xlsx) from one or more agencies, or any CSV with inspection data.
        </p>
      </div>

      {/* Combined totals bar */}
      {hasFiles && (
        <div className="mb-4 bg-primary-50/60 border border-primary-200 rounded-[var(--radius-lg)] px-4 py-3 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-bold text-primary-700">
                {totalFarms} inspection{totalFarms !== 1 ? "s" : ""}
                {uniqueAgencies.length > 1
                  ? ` from ${uniqueAgencies.length} agencies`
                  : uniqueAgencies.length === 1 && uniqueAgencies[0] !== "SAMPLE"
                    ? ` from ${uniqueAgencies[0]}`
                    : ""}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {totalUrgent > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                  <Zap className="w-3 h-3" />
                  {totalUrgent} urgent
                </span>
              )}
              {totalSkipped > 0 && (
                <span className="inline-flex items-center gap-1 text-earth-400 font-medium">
                  <ShieldAlert className="w-3 h-3" />
                  {totalSkipped} excluded
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-file cards */}
      {uploadedFiles.length > 0 && (
        <div className="mb-4 space-y-2">
          {uploadedFiles.map((uf) => {
            const fileUrgent = uf.farms.filter((f) => f.priority === "urgent").length;
            return (
              <div
                key={uf.id}
                className="flex items-center justify-between bg-white border border-earth-200 rounded-[var(--radius-md)] px-3 py-2.5 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary-800 truncate">
                        {uf.fileName}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${getAgencyColor(uf.agency)}`}
                      >
                        {uf.agency}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-primary-600/50 mt-0.5">
                      <span>{uf.farms.length} inspection{uf.farms.length !== 1 ? "s" : ""}</span>
                      {fileUrgent > 0 && (
                        <span className="text-red-500 font-medium">{fileUrgent} urgent</span>
                      )}
                      {uf.skipped.length > 0 && (
                        <span>{uf.skipped.length} excluded</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(uf.id);
                  }}
                  className="p-1 rounded hover:bg-red-50 text-earth-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  aria-label={`Remove ${uf.fileName}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-[var(--radius-xl)] text-center cursor-pointer
          transition-all duration-300 group
          ${hasFiles ? "p-6 sm:p-8" : "p-8 sm:p-14"}
          ${dragOver
            ? "border-primary-400 bg-primary-50/80 scale-[1.01]"
            : hasFiles
              ? "border-earth-200 bg-earth-50/30 hover:border-primary-300 hover:bg-primary-50/20"
              : "border-earth-300 bg-white hover:border-primary-300 hover:bg-primary-50/20"
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx,.csv,.tsv,.txt"
          multiple
          className="hidden"
          onChange={onFileSelect}
          aria-hidden="true"
        />

        {parsing ? (
          <div className="flex flex-col items-center py-2">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-3">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            </div>
            <p className="text-primary-700 font-semibold text-sm">Parsing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-2">
            <div className={`rounded-full flex items-center justify-center mb-3 transition-colors duration-300 ${
              hasFiles
                ? "w-10 h-10 bg-earth-100 group-hover:bg-primary-100"
                : "w-16 h-16 bg-earth-100 group-hover:bg-primary-100"
            }`}>
              <Upload className={`text-earth-300 group-hover:text-primary-500 transition-colors duration-300 ${
                hasFiles ? "w-5 h-5" : "w-7 h-7"
              }`} />
            </div>
            <p className={`text-primary-800 font-semibold ${hasFiles ? "text-sm" : ""}`}>
              {hasFiles ? "Drop another file to add more" : "Drag & drop your file here"}
            </p>
            <p className="text-primary-600/50 text-xs mt-1">
              Supports .xls, .xlsx, and .csv — multiple files OK
            </p>
          </div>
        )}
      </div>

      {/* Errors / info messages */}
      {allErrors.length > 0 && (
        <div className="mt-5 bg-gold-50 border border-gold-200 rounded-[var(--radius-lg)] p-4 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gold-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gold-700 text-sm">Import Notes</p>
              <ul className="mt-1 text-sm text-gold-600 space-y-1">
                {allErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            loadSample();
          }}
          className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-[var(--radius-md)] hover:bg-primary-100 transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Try with sample data
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadTemplate();
          }}
          className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-primary-700/70 bg-white border border-earth-200 rounded-[var(--radius-md)] hover:bg-earth-50 hover:border-earth-300 transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download template
        </button>
      </div>

      {/* Expected format info */}
      <div className="mt-10 bg-white border border-earth-200 rounded-[var(--radius-xl)] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="w-4 h-4 text-primary-600" />
          <h3 className="text-sm font-bold text-primary-800 tracking-wide uppercase">
            Supported Formats
          </h3>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-primary-700 mb-1.5">
              Intact Platform Export (.xls / .xlsx)
            </p>
            <p className="text-xs text-primary-600/50 leading-relaxed">
              Auto-detects PCO and CCOF column layouts. Supports Priority, Name, Services, Completion Window, Address fields, Contact info, NOP ID, and Audit Number. &ldquo;DO NOT INSPECT&rdquo; entries are automatically excluded.
            </p>
          </div>
          <div className="border-t border-earth-100 pt-3">
            <p className="text-sm font-semibold text-primary-700 mb-1.5">
              Generic CSV
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { name: "Name", req: true },
                { name: "Street / City / State / ZIP", req: false },
                { name: "Email / Phone", req: false },
                { name: "Services", req: false },
                { name: "Priority", req: false },
                { name: "Completion from / until", req: false },
              ].map((col) => (
                <div key={col.name} className="flex items-center gap-2 py-0.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      col.req ? "bg-primary-500" : "bg-earth-300"
                    }`}
                  />
                  <span className={`text-xs ${col.req ? "text-primary-800 font-semibold" : "text-primary-700/60"}`}>
                    {col.name}
                    {col.req && (
                      <span className="text-gold-500 ml-1 text-[10px] font-bold uppercase">
                        required
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
