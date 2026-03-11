"use client";

import { useState, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Farm } from "@/lib/types";
import { geocodeFarms, countUngeocoded } from "@/lib/geocode";
import FileUpload from "@/components/FileUpload";

interface UploadStepProps {
  farms: Farm[];
  onFarmsLoaded: (farms: Farm[], skipped: Farm[]) => void;
  onComplete: (geocodedFarms: Farm[]) => void;
}

export default function UploadStep({ farms, onFarmsLoaded, onComplete }: UploadStepProps) {
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ completed: 0, total: 0 });
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const handleContinue = useCallback(async () => {
    const needsGeo = farms.filter((f) => f.lat === 0 && f.lng === 0).length;

    if (needsGeo > 0) {
      setIsGeocoding(true);
      setGeocodeProgress({ completed: 0, total: 0 });
      setGeocodeError(null);

      try {
        const geocoded = await geocodeFarms(farms, (completed, total) => {
          setGeocodeProgress({ completed, total });
        });

        const remaining = countUngeocoded(geocoded);
        if (remaining > 0) {
          setGeocodeError(
            `${remaining} farm(s) could not be geocoded. They will use approximate locations.`
          );
        }

        setIsGeocoding(false);
        onComplete(geocoded);
      } catch {
        setIsGeocoding(false);
        setGeocodeError("Geocoding failed. Please check your internet connection and try again.");
      }
    } else {
      onComplete(farms);
    }
  }, [farms, onComplete]);

  return (
    <>
      <FileUpload onFarmsLoaded={onFarmsLoaded} />
      {farms.length > 0 && (
        <div className="max-w-2xl mx-auto mt-8 animate-fade-in-up">
          {/* Geocoding progress */}
          {isGeocoding && (
            <div className="mb-4 p-4 bg-primary-50 rounded-[var(--radius-lg)] border border-primary-100">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                <span className="text-sm font-medium text-primary-700">
                  Geocoding addresses...
                </span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-primary-500" />
                <div className="flex-1">
                  <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-300"
                      style={{
                        width: geocodeProgress.total > 0
                          ? `${(geocodeProgress.completed / geocodeProgress.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-primary-600 tabular-nums">
                  {geocodeProgress.completed}/{geocodeProgress.total} locations
                </span>
              </div>
            </div>
          )}

          {/* Geocoding error/warning */}
          {geocodeError && !isGeocoding && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-[var(--radius-md)] border border-amber-200">
              {geocodeError}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={isGeocoding}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-[var(--radius-lg)] hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md shadow-primary-600/20 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeocoding ? "Geocoding..." : "Continue to Preferences"}
          </button>
        </div>
      )}
    </>
  );
}
