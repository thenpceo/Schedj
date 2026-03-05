/**
 * Geocoding utility using OpenStreetMap Nominatim API.
 * Deduplicates by zip code to minimize requests.
 * Rate-limited to 1 req/sec per Nominatim usage policy.
 */

import { Farm } from "./types";

interface GeoResult {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const RATE_LIMIT_MS = 1100; // slightly over 1 second to be safe

// In-memory cache for the session
const zipCache = new Map<string, GeoResult | null>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geocode a single address by zip code + country using Nominatim.
 * Returns null if geocoding fails.
 */
async function geocodeByZip(
  zip: string,
  city: string,
  state: string,
  country: string
): Promise<GeoResult | null> {
  // Try zip code first (most precise and fastest)
  const countryCode = countryToCode(country);
  const query = [zip, city, state].filter(Boolean).join(", ");

  try {
    const params = new URLSearchParams({
      q: query,
      countrycodes: countryCode,
      format: "json",
      limit: "1",
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "SCHEDJ-InspectionScheduler/0.1 (prototype)",
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const results = await response.json();
    if (results && results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
      };
    }
  } catch {
    // Network error — fall through
  }

  return null;
}

/**
 * Convert country name to ISO 3166-1 alpha-2 code.
 */
function countryToCode(country: string): string {
  const lower = (country || "").toLowerCase().trim();
  if (lower.includes("united states") || lower === "us" || lower === "usa") return "us";
  if (lower.includes("canada") || lower === "ca") return "ca";
  if (lower.includes("mexico") || lower === "mx") return "mx";
  // Default to US for organic inspections
  return "us";
}

/**
 * Build a cache key from address components.
 * Uses zip as primary key (most reliable), falls back to city+state.
 */
function cacheKey(farm: Farm): string {
  if (farm.zip) return `${farm.zip}-${countryToCode(farm.country)}`;
  return `${farm.city}-${farm.state}-${countryToCode(farm.country)}`.toLowerCase();
}

/**
 * Geocode all farms that have lat=0, lng=0.
 * Deduplicates by zip code to minimize API calls.
 * Returns updated farms array with coordinates filled in.
 *
 * @param farms - Array of farms to geocode
 * @param onProgress - Callback with (completed, total) for progress reporting
 */
export async function geocodeFarms(
  farms: Farm[],
  onProgress?: (completed: number, total: number) => void
): Promise<Farm[]> {
  // Find farms that need geocoding
  const needsGeocoding = farms.filter((f) => f.lat === 0 && f.lng === 0);
  if (needsGeocoding.length === 0) return farms;

  // Deduplicate by cache key (zip code or city+state)
  const uniqueKeys = new Map<string, Farm>(); // key → representative farm
  for (const farm of needsGeocoding) {
    const key = cacheKey(farm);
    if (!uniqueKeys.has(key) && !zipCache.has(key)) {
      uniqueKeys.set(key, farm);
    }
  }

  const totalToGeocode = uniqueKeys.size;
  let completed = 0;

  // Geocode each unique location with rate limiting
  for (const [key, farm] of uniqueKeys) {
    const result = await geocodeByZip(farm.zip, farm.city, farm.state, farm.country);
    zipCache.set(key, result);
    completed++;
    onProgress?.(completed, totalToGeocode);

    // Rate limit (only if more requests pending)
    if (completed < totalToGeocode) {
      await delay(RATE_LIMIT_MS);
    }
  }

  // Apply geocoded coordinates to all farms
  return farms.map((farm) => {
    if (farm.lat !== 0 || farm.lng !== 0) return farm; // already has coordinates

    const key = cacheKey(farm);
    const result = zipCache.get(key);
    if (result) {
      return { ...farm, lat: result.lat, lng: result.lng };
    }
    return farm;
  });
}

/**
 * Check how many farms still need geocoding after a geocode pass.
 */
export function countUngeocoded(farms: Farm[]): number {
  return farms.filter((f) => f.lat === 0 && f.lng === 0).length;
}
