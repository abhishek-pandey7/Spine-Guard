export type RecoveryPhase = 1 | 2 | 3;

export type ViolationType =
  | 'BENDING'
  | 'TWISTING'
  | 'LIFTING'
  | 'OVER_EXTENSION';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface RepLog {
  repNumber: number;
  peakAngle: number;
  compliant: boolean;
  violations: string[];
  timestamp: number;
}

export interface SessionLog {
  exerciseId: string;
  phase: RecoveryPhase;
  totalReps: number;
  compliantReps: number;
  complianceScore: number;
  peakAngle: number;
  painScore: number;
  reps: RepLog[];
  sessionDate: string;
}

export interface ProgressEntry {
  sessionDate: string;
  exerciseId: string;
  complianceScore: number;
  totalReps: number;
  peakAngle: number;
  phase: RecoveryPhase;
}
