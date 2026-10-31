/**
 * Geographic calculations and Leaflet helpers for RuralCare Connect
 */

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 * Returns distance in kilometers, rounded to 1 decimal place.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Estimates driving time in minutes assuming rural road ambulance average speed of 38 km/h.
 */
export function estimateDriveMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const speedKmH = 38;
  const mins = Math.ceil((distanceKm / speedKmH) * 60);
  return Math.max(5, mins);
}

/**
 * Format coordinates for human display (e.g. 23.6338° N, 85.5145° E)
 */
export function formatCoordinates(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return 'Coordinates unavailable';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

