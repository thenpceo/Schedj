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
} from "lucide-react";
import { Farm } from "@/lib/types";
import { parseFile, generateCSVTemplate } from "@/lib/parser";
import { SAMPLE_FARMS } from "@/lib/sample-data";

interface FileUploadProps {
  onFarmsLoaded: (farms: Farm[], skipped: Farm[]) => void;
}

export default function FileUpload({ onFarmsLoaded }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [farmCount, setFarmCount] = useState<number | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setParsing(true);
      setErrors([]);
      setFarmCount(null);
      setSkippedCount(0);
      setUrgentCount(0);

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (!result) {
          setParsing(false);
          setErrors(["Failed to read file."]);
          return;
        }

        const { farms, skipped, errors: parseErrors } = parseFile(
          result as ArrayBuffer,
          file.name
        );
        setParsing(false);

        if (parseErrors.length > 0) {
          setErrors(parseErrors);
        }

        if (farms.length > 0) {
          setFarmCount(farms.length);
          setSkippedCount(skipped.length);
          setUrgentCount(farms.filter((f) => f.priority === "urgent").length);
          onFarmsLoaded(farms, skipped);
        }
      };
      reader.onerror = () => {
        setParsing(false);
        setErrors(["Failed to read file. Please try again."]);
      };

      reader.readAsArrayBuffer(file);
    },
    [onFarmsLoaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const loadSample = useCallback(() => {
    setParsing(true);
    setErrors([]);
    setTimeout(() => {
      const farms = SAMPLE_FARMS.filter((f) => f.priority !== "do_not_inspect");
      const skipped = SAMPLE_FARMS.filter((f) => f.priority === "do_not_inspect");
      setFarmCount(farms.length);
      setSkippedCount(skipped.length);
      setUrgentCount(farms.filter((f) => f.priority === "urgent").length);
      setParsing(false);
      onFarmsLoaded(farms, skipped);
    }, 600);
  }, [onFarmsLoaded]);

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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-10">
        <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold text-primary-800 mb-3">
          Upload Your Inspection List
        </h2>
        <p className="text-sm sm:text-base text-primary-700/60 max-w-md mx-auto leading-relaxed">
          Upload the Intact Platform export (.xls) from your supervisor, or any
          CSV with inspection data.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-[var(--radius-xl)] p-8 sm:p-14 text-center cursor-pointer
          transition-all duration-300 group
          ${dragOver
            ? "border-primary-400 bg-primary-50/80 scale-[1.01]"
            : farmCount !== null
              ? "border-primary-300 bg-primary-50/40"
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
          className="hidden"
          onChange={onFileSelect}
          aria-hidden="true"
        />

        {parsing ? (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
            <p className="text-primary-700 font-semibold">Parsing your data...</p>
          </div>
        ) : farmCount !== null ? (
          <div className="flex flex-col items-center py-4 animate-fade-in-up">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary-600" />
            </div>
            <p className="text-primary-700 font-bold text-lg">
              {farmCount} inspections loaded
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              {urgentCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-red-600 font-semibold">
                  <Zap className="w-3.5 h-3.5" />
                  {urgentCount} urgent
                </span>
              )}
              {skippedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-earth-400 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {skippedCount} excluded
                </span>
              )}
            </div>
            <p className="text-primary-600/50 mt-2 text-sm">
              Drop a new file to replace, or continue below
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-earth-100 flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors duration-300">
              <Upload className="w-7 h-7 text-earth-300 group-hover:text-primary-500 transition-colors duration-300" />
            </div>
            <p className="text-primary-800 font-semibold mb-1">
              Drag &amp; drop your file here
            </p>
            <p className="text-primary-600/50 text-sm">
              Supports .xls, .xlsx, and .csv files
            </p>
          </div>
        )}
      </div>

      {/* Errors / info messages */}
      {errors.length > 0 && (
        <div className="mt-5 bg-gold-50 border border-gold-200 rounded-[var(--radius-lg)] p-4 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gold-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gold-700 text-sm">Import Notes</p>
              <ul className="mt-1 text-sm text-gold-600 space-y-1">
                {errors.map((err, i) => (
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
              Intact Platform Export (.xls)
            </p>
            <p className="text-xs text-primary-600/50 leading-relaxed">
              Auto-detects columns: Priority, Name, Services, Completion Window, Address fields, Contact info, NOP ID, and Audit Number. &ldquo;DO NOT INSPECT&rdquo; entries are automatically excluded.
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
