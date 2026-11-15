import { ZoneRecord } from '@/types/database';

export interface ZoneResolutionResult {
  matched: boolean;
  outsideServiceArea: boolean;
  zone: ZoneRecord | null;
  nearestZone: ZoneRecord | null;
  distanceKm: number;
  message: string;
}

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Snaps a dropped map pin (lat, lng) to the nearest active served zone.
 * If the pin is outside all served zone radii, flags outsideServiceArea=true
 * while returning the nearest served zone as a recommended option (FR-3.2, FR-3.3).
 */
export function resolvePinToZone(
  lat: number,
  lng: number,
  zones: ZoneRecord[]
): ZoneResolutionResult {
  const activeZones = zones.filter((z) => z.active);
  if (activeZones.length === 0) {
    return {
      matched: false,
      outsideServiceArea: true,
      zone: null,
      nearestZone: null,
      distanceKm: 0,
      message: 'No active service zones are currently configured for this airport.',
    };
  }

  let closest: ZoneRecord = activeZones[0];
  let minDistance = haversineDistanceKm(lat, lng, closest.lat, closest.lng);

  for (let i = 1; i < activeZones.length; i++) {
    const candidate = activeZones[i];
    const dist = haversineDistanceKm(lat, lng, candidate.lat, candidate.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = candidate;
    }
  }

  const effectiveRadius = closest.radius_km || 3.5;
  const insideServedZone = minDistance <= effectiveRadius;

  if (insideServedZone) {
    return {
      matched: true,
      outsideServiceArea: false,
      zone: closest,
      nearestZone: closest,
      distanceKm: minDistance,
      message: `Snapped to ${closest.name} (${minDistance.toFixed(1)} km from zone center).`,
    };
  }

  return {
    matched: false,
    outsideServiceArea: true,
    zone: null,
    nearestZone: closest,
    distanceKm: minDistance,
    message: `Pin is ${minDistance.toFixed(1)} km from ${closest.name}, outside our current shared zone boundary (${effectiveRadius.toFixed(1)} km). You can snap to ${closest.name} or book a fixed-fare solo ride.`,
  };
}
