import type { Landmark } from '../types/session';
import { calculateJointAngle } from './angleCalculator';

export interface GuardResult {
  violation: boolean;
  message: string;
}

type ExerciseGuardFn = (landmarks: Landmark[]) => GuardResult;

/**
 * Per-exercise AI safety guards.
 * Each guard checks the specific movement pattern for that exercise.
 */
const GUARDS: Record<string, ExerciseGuardFn> = {
  'ankle-pumps': (lm) => {
    // Check that the lower back is not arching (hip should stay flat)
    const lHip = lm[23];
    const rHip = lm[24];
    const lShoulder = lm[11];
    if (!lHip || !rHip || !lShoulder) return { violation: false, message: '' };
    const hipY = (lHip.y + rHip.y) / 2;
    const shoulderY = lShoulder.y;
    // If hip Y unexpectedly rises relative to shoulder, back is lifting
    if (hipY < shoulderY - 0.35) {
      return { violation: true, message: 'Keep your back flat. Do not lift your leg.' };
    }
    return { violation: false, message: '' };
  },

  'abdominal-bracing': (lm) => {
    const lHip = lm[23];
    const rHip = lm[24];
    const lShoulder = lm[11];
    const rShoulder = lm[12];
    if (!lHip || !rHip || !lShoulder || !rShoulder) return { violation: false, message: '' };
    const midHip: Landmark = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2, z: (lHip.z + rHip.z) / 2 };
    const midShoulder: Landmark = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2, z: (lShoulder.z + rShoulder.z) / 2 };
    const dx = Math.abs(midShoulder.x - midHip.x);
    if (dx > 0.1) {
      return { violation: true, message: 'Your lower back is arching. Press it toward the floor.' };
    }
    return { violation: false, message: '' };
  },

  'log-rolling': (lm) => {
    const lShoulder = lm[11];
    const rShoulder = lm[12];
    const lHip = lm[23];
    const rHip = lm[24];
    if (!lShoulder || !rShoulder || !lHip || !rHip) return { violation: false, message: '' };
    const shoulderZ = (lShoulder.z + rShoulder.z) / 2;
    const hipZ = (lHip.z + rHip.z) / 2;
    const zDiff = Math.abs(shoulderZ - hipZ);
    if (zDiff > 0.08) {
      return { violation: true, message: 'Twist detected! Move shoulders and hips together.' };
    }
    return { violation: false, message: '' };
  },

  'bird-dog': (lm) => {
    const lShoulder = lm[11];
    const rShoulder = lm[12];
    const lHip = lm[23];
    const rHip = lm[24];
    if (!lShoulder || !rShoulder || !lHip || !rHip) return { violation: false, message: '' };
    const midShoulder: Landmark = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2, z: (lShoulder.z + rShoulder.z) / 2 };
    const midHip: Landmark = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2, z: (lHip.z + rHip.z) / 2 };
    const spineAngle = Math.abs(midShoulder.y - midHip.y);
    if (spineAngle < 0.05) {
      return { violation: true, message: 'Your spine is sagging. Engage your core and lift.' };
    }
    return { violation: false, message: '' };
  },

  'supported-squats': (lm) => {
    const lShoulder = lm[11];
    const lHip = lm[23];
    const lKnee = lm[25];
    if (!lShoulder || !lHip || !lKnee) return { violation: false, message: '' };
    const torsoAngle = calculateJointAngle(lShoulder, lHip, lKnee);
    if (torsoAngle < 140) {
      return { violation: true, message: 'Stand more upright. Your torso is bending forward.' };
    }
    return { violation: false, message: '' };
  },
};

export function getExerciseGuard(exerciseId: string, landmarks: Landmark[]): GuardResult | null {
  const guard = GUARDS[exerciseId];
  if (!guard) return null;
  return guard(landmarks);
}
