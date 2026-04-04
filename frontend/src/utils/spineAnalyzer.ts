import type { Landmark } from '../types/session';
import { calculateJointAngle, midpoint } from './angleCalculator';

export interface SpineAnalysisResult {
  isBending: boolean;
  isTwisting: boolean;
  bendAngle: number;
  twistDelta: number;
  shoulderHipAngle: number;
}

/**
 * Analyzes pose landmarks for spine safety violations.
 * Landmarks follow MediaPipe Pose numbering:
 *   11=left shoulder, 12=right shoulder, 23=left hip, 24=right hip
 */
export function analyzeSpine(landmarks: Landmark[]): SpineAnalysisResult {
  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];
  const lHip = landmarks[23];
  const rHip = landmarks[24];
  const nose = landmarks[0];

  if (!lShoulder || !rShoulder || !lHip || !rHip) {
    return { isBending: false, isTwisting: false, bendAngle: 0, twistDelta: 0, shoulderHipAngle: 180 };
  }

  // Mid-points of shoulders and hips define the spine axis
  const midShoulder = midpoint(lShoulder, rHip);
  const midHip = midpoint(lHip, rHip);

  // A vertical reference point above midHip
  const verticalRef: Landmark = { x: midHip.x, y: midHip.y - 1, z: midHip.z };

  // Bend angle: deviation of spine from vertical
  const bendAngle = calculateJointAngle(verticalRef, midHip, midShoulder);

  // Twist: difference in Z-depth between left and right shoulders
  const twistDelta = Math.abs(lShoulder.z - rShoulder.z);

  // Head forward check using nose vs mid-shoulder X
  const shoulderHipAngle = nose
    ? calculateJointAngle(nose, midShoulder, midHip)
    : 180;

  const BEND_THRESHOLD = 165; // degrees — below this = bending
  const TWIST_THRESHOLD = 0.07; // normalized z difference

  return {
    isBending: bendAngle < BEND_THRESHOLD,
    isTwisting: twistDelta > TWIST_THRESHOLD,
    bendAngle,
    twistDelta,
    shoulderHipAngle,
  };
}
