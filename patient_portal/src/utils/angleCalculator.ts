import type { Landmark } from '../types/session';

/**
 * 3D vector from point A to point B
 */
export function vector3D(a: Landmark, b: Landmark): [number, number, number] {
  return [b.x - a.x, b.y - a.y, b.z - a.z];
}

/**
 * Dot product of two 3D vectors
 */
export function dot3D(v1: [number, number, number], v2: [number, number, number]): number {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

/**
 * Magnitude of a 3D vector
 */
export function magnitude3D(v: [number, number, number]): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

/**
 * Angle (degrees) at joint B, formed by A-B-C
 */
export function calculateJointAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = vector3D(b, a);
  const v2 = vector3D(b, c);
  const dot = dot3D(v1, v2);
  const mag1 = magnitude3D(v1);
  const mag2 = magnitude3D(v2);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * Simple IIR low-pass filter for smoothing angle readings
 */
export class AngleSmoother {
  private smoothed: number | null = null;
  private readonly alpha: number;
  constructor(alpha = 0.7) { this.alpha = alpha; }
  smooth(raw: number): number {
    if (this.smoothed === null) { this.smoothed = raw; return raw; }
    this.smoothed = this.alpha * this.smoothed + (1 - this.alpha) * raw;
    return this.smoothed;
  }
  reset(): void { this.smoothed = null; }
  get value(): number | null { return this.smoothed; }
}

/**
 * Midpoint between two landmarks
 */
export function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

/**
 * 2D Euclidean distance (normalized coords)
 */
export function distance2D(a: Landmark, b: Landmark): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}