import type { Coordinate } from './types';

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a: Coordinate, b: Coordinate): number {
  const rad = (v: number) => (v * Math.PI) / 180;
  const deg = (v: number) => (v * 180) / Math.PI;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Rejects poor fixes and implausible jumps. It intentionally does not delete
 * raw observations; caller keeps those separately for audit/debugging.
 */
export function acceptGpsPoint(point: Coordinate, previous?: Coordinate): boolean {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return false;
  if (point.accuracy !== undefined && point.accuracy > 45) return false;
  if (!previous) return true;
  const delta = distanceMeters(previous, point);
  const seconds = Math.max(1, (point.timestamp - previous.timestamp) / 1000);
  // Allow brisk walking/running, but reject large GPS jumps.
  if (delta > 55 && seconds < 8) return false;
  if (delta < 2.5 && seconds < 4) return false;
  return true;
}

/**
 * Weighted local smoothing. Raw points remain untouched. Small jitter is
 * damped, while sharp turns retain more of their original geometry.
 */
export function smoothTrail(points: Coordinate[]): Coordinate[] {
  if (points.length < 3) return points.map(p => ({ ...p }));
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return { ...point };
    const before = points[index - 1];
    const after = points[index + 1];
    const turnA = bearingDegrees(before, point);
    const turnB = bearingDegrees(point, after);
    const angle = Math.abs(((turnB - turnA + 540) % 360) - 180);
    // Preserve sharper corners; smooth near-straight sections more.
    const alpha = angle > 45 ? 0.12 : 0.28;
    return {
      ...point,
      lat: point.lat * (1 - alpha) + (before.lat + after.lat) / 2 * alpha,
      lng: point.lng * (1 - alpha) + (before.lng + after.lng) / 2 * alpha
    };
  });
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function mapsUrl(point: Coordinate): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=walking`;
}