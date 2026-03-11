import { Farm, HotelSuggestion, TripV3 } from "./types";

/**
 * Compute the geographic centroid of farms in a trip.
 * Returns null if no farms.
 */
export function tripCentroid(trip: TripV3): { lat: number; lng: number } | null {
  const farms = trip.days.flatMap((d) => d.inspections.map((i) => i.farm));
  if (farms.length === 0) return null;
  return {
    lat: farms.reduce((s, f) => s + f.lat, 0) / farms.length,
    lng: farms.reduce((s, f) => s + f.lng, 0) / farms.length,
  };
}

/**
 * Reverse geocode lat/lng to get ZIP + city using Nominatim.
 * Falls back to nearest farm's ZIP if reverse geocode fails.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ zip: string; city: string; state: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=12`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SCHEDJ-Scheduler/1.0" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address;
    if (!addr) return null;

    return {
      zip: addr.postcode || "",
      city: addr.city || addr.town || addr.village || addr.hamlet || "",
      state: addr.state || "",
    };
  } catch {
    return null;
  }
}

/**
 * Compute hotel suggestion for a trip.
 * Uses centroid + reverse geocode, falling back to nearest farm's ZIP.
 */
export async function computeHotelSuggestion(
  trip: TripV3
): Promise<HotelSuggestion | null> {
  // Only suggest hotels for multi-day trips
  if (trip.tripType === "day_trip") return null;

  const center = tripCentroid(trip);
  if (!center) return null;

  // Try reverse geocode
  const geo = await reverseGeocode(center.lat, center.lng);
  if (geo && geo.zip) {
    return {
      lat: center.lat,
      lng: center.lng,
      zip: geo.zip,
      city: geo.city,
      state: geo.state,
    };
  }

  // Fallback: use nearest farm's address info
  const farms = trip.days.flatMap((d) => d.inspections.map((i) => i.farm));
  const nearestFarm = findNearestFarm(center, farms);
  if (nearestFarm && nearestFarm.zip) {
    return {
      lat: center.lat,
      lng: center.lng,
      zip: nearestFarm.zip,
      city: nearestFarm.city || "",
      state: nearestFarm.state || "",
    };
  }

  return null;
}

/**
 * Find the farm nearest to a given point (Euclidean approximation).
 */
function findNearestFarm(
  point: { lat: number; lng: number },
  farms: Farm[]
): Farm | null {
  if (farms.length === 0) return null;

  let nearest = farms[0];
  let minDist = Infinity;

  for (const farm of farms) {
    const dlat = farm.lat - point.lat;
    const dlng = farm.lng - point.lng;
    const dist = dlat * dlat + dlng * dlng;
    if (dist < minDist) {
      minDist = dist;
      nearest = farm;
    }
  }

  return nearest;
}
