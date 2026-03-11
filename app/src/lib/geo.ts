const EARTH_RADIUS_MILES = 3959;
const ROAD_FACTOR = 1.35; // roads are ~35% longer than straight-line (safety margin)
const AVG_SPEED_MPH = 40; // rural average including farm roads

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Estimate road distance from haversine (straight-line) distance */
export function estimateRoadDistance(straightLineDistance: number): number {
  return straightLineDistance * ROAD_FACTOR;
}

/** Estimate drive time in minutes from haversine distance */
export function estimateDriveTimeMinutes(haversineDistanceMiles: number): number {
  const roadDistance = haversineDistanceMiles * ROAD_FACTOR;
  return Math.round((roadDistance * 60) / AVG_SPEED_MPH);
}

/** Convenience: road distance between two points */
export function driveDistanceBetween(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  return estimateRoadDistance(haversineDistance(lat1, lng1, lat2, lng2));
}

/** Convenience: drive time in minutes between two points */
export function driveTimeBetween(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  return estimateDriveTimeMinutes(haversineDistance(lat1, lng1, lat2, lng2));
}

/** Build a symmetric distance matrix (road miles) for a list of points */
export function buildDistanceMatrix(
  points: { lat: number; lng: number }[]
): number[][] {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = driveDistanceBetween(
        points[i].lat, points[i].lng,
        points[j].lat, points[j].lng
      );
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }
  return matrix;
}
