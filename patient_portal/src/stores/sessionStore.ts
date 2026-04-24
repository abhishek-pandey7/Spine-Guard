import { create } from 'zustand';
import type { Exercise } from '../types/exercise';

interface SessionState {
  // Data
  painScore: number;
  currentRep: number;
  totalReps: number;
  peakAngle: number;
  compliance: number;
  currentExercise: Exercise | null;
  currentPhase: 1 | 2 | 3;

  // Actions
  setPainScore: (score: number) => void;
  incrementRep: () => void;
  updatePeakAngle: (angle: number) => void;
  setCompliance: (value: number) => void;
  setTotalReps: (total: number) => void;
  setCurrentExercise: (exercise: Exercise | null) => void;
  setCurrentPhase: (phase: 1 | 2 | 3) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  painScore: 0,
  currentRep: 0,
  totalReps: 0,
  peakAngle: 0,
  compliance: 100,
  currentExercise: null,
  currentPhase: 1,

  setPainScore: (score) => set({ painScore: score }),
  incrementRep: () => set((s) => ({ currentRep: s.currentRep + 1 })),
  updatePeakAngle: (angle) =>
    set((s) => ({ peakAngle: Math.max(s.peakAngle, angle) })),
  setCompliance: (value) => set({ compliance: value }),
  setTotalReps: (total) => set({ totalReps: total }),
  setCurrentExercise: (exercise) => set({ currentExercise: exercise }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  resetSession: () =>
    set({
      painScore: 0,
      currentRep: 0,
      totalReps: 0,
      peakAngle: 0,
      compliance: 100,
      currentExercise: null,
      currentPhase: 1,
    }),
}));
