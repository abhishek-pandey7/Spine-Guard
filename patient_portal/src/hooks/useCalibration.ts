import { useState, useCallback, useRef } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

interface CalibrationState {
  isCalibrating: boolean;
  calibrationProgress: number;
  isCalibrated: boolean;
}

interface UseCalibrationReturn extends CalibrationState {
  startCalibration: (getLandmarks: () => NormalizedLandmark[] | null) => void;
  resetCalibration: () => void;
  baselineLandmarks: NormalizedLandmark[] | null;
}

const CALIBRATION_DURATION_MS = 3000;

export function useCalibration(): UseCalibrationReturn {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [baselineLandmarks, setBaselineLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCalibration = useCallback(
    (getLandmarks: () => NormalizedLandmark[] | null) => {
      if (isCalibrating) return;

      setIsCalibrating(true);
      setCalibrationProgress(0);
      setIsCalibrated(false);

      const startTime = Date.now();

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / CALIBRATION_DURATION_MS) * 100, 100);
        setCalibrationProgress(progress);

        if (elapsed >= CALIBRATION_DURATION_MS) {
          clearInterval(intervalRef.current!);
          const lm = getLandmarks();
          setBaselineLandmarks(lm);
          setIsCalibrating(false);
          setIsCalibrated(true);
        }
      }, 100);
    },
    [isCalibrating]
  );

  const resetCalibration = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsCalibrating(false);
    setCalibrationProgress(0);
    setIsCalibrated(false);
    setBaselineLandmarks(null);
  }, []);

  return {
    isCalibrating,
    calibrationProgress,
    isCalibrated,
    startCalibration,
    resetCalibration,
    baselineLandmarks,
  };
}