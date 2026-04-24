/**
 * boneEngine.ts
 * Provides a higher-level bone/joint abstraction on top of raw MediaPipe landmarks.
 * Maps named body segments to landmark indices and computes derived metrics.
 */
import type { Landmark } from '../types/session';
import { calculateJointAngle, midpoint, distance2D } from './angleCalculator';

// MediaPipe Pose landmark indices
export const LANDMARK_INDICES = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT: 31,
  RIGHT_FOOT: 32,
} as const;

export interface BoneMetrics {
  spineAngle: number;          // Deviation from vertical (degrees)
  shoulderTwist: number;       // Z-depth diff between shoulders (normalized)
  hipTwist: number;            // Z-depth diff between hips (normalized)
  leftKneeAngle: number;
  rightKneeAngle: number;
  leftHipAngle: number;
  rightHipAngle: number;
  trunkLength: number;         // Normalized distance shoulder-to-hip
}

/**
 * Safely get a landmark or return null
 */
export function getLandmark(lm: Landmark[], index: number): Landmark | null {
  if (!lm || index >= lm.length) return null;
  const l = lm[index];
  if ((l.visibility ?? 1) < 0.3) return null;
  return l;
}

/**
 * Compute all bone metrics from a pose landmark array
 */
export function computeBoneMetrics(lm: Landmark[]): BoneMetrics | null {
  const lShoulder = getLandmark(lm, LANDMARK_INDICES.LEFT_SHOULDER);
  const rShoulder = getLandmark(lm, LANDMARK_INDICES.RIGHT_SHOULDER);
  const lHip = getLandmark(lm, LANDMARK_INDICES.LEFT_HIP);
  const rHip = getLandmark(lm, LANDMARK_INDICES.RIGHT_HIP);
  const lKnee = getLandmark(lm, LANDMARK_INDICES.LEFT_KNEE);
  const rKnee = getLandmark(lm, LANDMARK_INDICES.RIGHT_KNEE);
  const lAnkle = getLandmark(lm, LANDMARK_INDICES.LEFT_ANKLE);
  const rAnkle = getLandmark(lm, LANDMARK_INDICES.RIGHT_ANKLE);

  if (!lShoulder || !rShoulder || !lHip || !rHip) return null;

  const midShoulder = midpoint(lShoulder, rShoulder);
  const midHip = midpoint(lHip, rHip);

  // Spine angle vs vertical
  const vertRef: Landmark = { x: midHip.x, y: midHip.y - 1, z: midHip.z };
  const spineAngle = calculateJointAngle(vertRef, midHip, midShoulder);

  const shoulderTwist = Math.abs(lShoulder.z - rShoulder.z);
  const hipTwist = Math.abs(lHip.z - rHip.z);
  const trunkLength = distance2D(midShoulder, midHip);

  const leftKneeAngle =
    lHip && lKnee && lAnkle ? calculateJointAngle(lHip, lKnee, lAnkle) : 180;
  const rightKneeAngle =
    rHip && rKnee && rAnkle ? calculateJointAngle(rHip, rKnee, rAnkle) : 180;
  const leftHipAngle =
    lShoulder && lHip && lKnee ? calculateJointAngle(lShoulder, lHip, lKnee) : 180;
  const rightHipAngle =
    rShoulder && rHip && rKnee ? calculateJointAngle(rShoulder, rHip, rKnee) : 180;

  return {
    spineAngle,
    shoulderTwist,
    hipTwist,
    leftKneeAngle,
    rightKneeAngle,
    leftHipAngle,
    rightHipAngle,
    trunkLength,
  };
}
