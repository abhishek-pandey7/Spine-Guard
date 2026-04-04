import { useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { logSession } from '../utils/apiClient';

export interface RepData {
  repNumber: number;
  peakAngle: number;
  compliant: boolean;
  violations: string[];
  timestamp: number;
}

export function useSessionTracker() {
  const repDataRef = useRef<RepData[]>([]);
  const {
    currentRep,
    totalReps,
    peakAngle,
    painScore,
    incrementRep,
    updatePeakAngle,
    setCompliance,
  } = useSessionStore();

  const startRep = useCallback(() => {
    // hook for future rep-timing logic
  }, []);

  const endRep = useCallback(
    (angle: number, violations: string[]) => {
      const repData: RepData = {
        repNumber: currentRep + 1,
        peakAngle: angle,
        compliant: violations.length === 0,
        violations,
        timestamp: Date.now(),
      };
      repDataRef.current.push(repData);
      updatePeakAngle(angle);
      incrementRep();

      const compliantReps = repDataRef.current.filter((r) => r.compliant).length;
      const compliance = Math.round((compliantReps / repDataRef.current.length) * 100);
      setCompliance(compliance);
    },
    [currentRep, incrementRep, updatePeakAngle, setCompliance]
  );

  const endSession = useCallback(
    async (exerciseId: string, phase: number) => {
      const compliantReps = repDataRef.current.filter((r) => r.compliant).length;
      const complianceScore =
        repDataRef.current.length > 0
          ? Math.round((compliantReps / repDataRef.current.length) * 100)
          : 0;

      const payload = {
        exerciseId,
        phase,
        totalReps: repDataRef.current.length,
        compliantReps,
        complianceScore,
        peakAngle,
        painScore,
        reps: repDataRef.current,
        sessionDate: new Date().toISOString(),
      };

      try {
        await logSession(payload);
      } catch (err) {
        console.error('Failed to log session:', err);
      }

      repDataRef.current = [];
      return payload;
    },
    [peakAngle, painScore]
  );

  return { currentRep, totalReps, peakAngle, startRep, endRep, endSession };
}