import { useCallback, useRef, useState } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { calculateJointAngle, AngleSmoother } from '../utils/angleCalculator';
import { getExerciseGuard } from '../utils/exerciseGuards';
import { useSessionStore } from '../stores/sessionStore';

interface UseMediaPipeReturn {
  landmarks: NormalizedLandmark[] | null;
  isLoading: boolean;
  initMediaPipe: () => Promise<void>;
}

export function useMediaPipe(
  videoRef: React.RefObject<HTMLVideoElement>,
  onRepComplete?: (angle: number, violations: string[]) => void // Link to useSessionTracker.endRep
): UseMediaPipeReturn {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for AI Processing
  const animFrameRef = useRef<number | null>(null);
  const poseLandmarkerRef = useRef<any>(null);
  const smoother = useRef(new AngleSmoother(0.6));

  // State Machine for Rep Counting
  const isInRep = useRef(false);
  const currentPeakAngle = useRef(0);
  const activeViolations = useRef<Set<string>>(new Set());
  const holdStartTime = useRef<number | null>(null);

  const { currentExercise } = useSessionStore();

  const initMediaPipe = useCallback(async () => {
    setIsLoading(true);
    try {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      poseLandmarkerRef.current = poseLandmarker;

      const detect = () => {
        const video = videoRef.current;
        if (video && video.readyState >= 2 && poseLandmarkerRef.current) {
          const result = poseLandmarkerRef.current.detectForVideo(video, performance.now());

          if (result.landmarks?.[0]) {
            const currentLms = result.landmarks[0];
            setLandmarks(currentLms);

            // --- AI GUARD & REP LOGIC ---
            if (currentExercise) {
              // 1. Run Safety Guard
              const guard = getExerciseGuard(currentExercise.id, currentLms);
              if (guard?.violation) {
                activeViolations.current.add(guard.message);
                // Note: You can also update a 'currentViolation' state in your store here
              }

              // 2. Calculate Smoothed Angle (Using Knee-Hip-Shoulder for most movements)
              const rawAngle = calculateJointAngle(currentLms[11], currentLms[23], currentLms[25]);
              const angle = smoother.current.smooth(rawAngle);

              // 3. Movement State Machine
              // Thresholds logic (Adjust per exercise type)
              const isFlexionEx = ['squat', 'lunge', 'supported-squats'].includes(currentExercise.id);
              const entryThreshold = isFlexionEx ? 150 : 160;
              const exitThreshold = isFlexionEx ? 170 : 175;

              // START REP
              if (!isInRep.current && (isFlexionEx ? angle < entryThreshold : angle > entryThreshold)) {
                isInRep.current = true;
                holdStartTime.current = performance.now();
              }

              if (isInRep.current) {
                // Update peak for the session data
                currentPeakAngle.current = isFlexionEx
                  ? Math.min(currentPeakAngle.current || 180, angle)
                  : Math.max(currentPeakAngle.current, angle);

                // END REP (Check if user returned to neutral)
                const returnedToNeutral = isFlexionEx ? angle > exitThreshold : angle < exitThreshold;

                if (returnedToNeutral) {
                  // Ensure hold time was met (if exercise requires it)
                  const holdDuration = (performance.now() - (holdStartTime.current || 0)) / 1000;

                  if (holdDuration >= (currentExercise.holdSeconds || 0)) {
                    onRepComplete?.(currentPeakAngle.current, Array.from(activeViolations.current));
                  }

                  // Reset trackers
                  isInRep.current = false;
                  currentPeakAngle.current = 0;
                  activeViolations.current.clear();
                  holdStartTime.current = null;
                }
              }
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(detect);
      };

      detect();
    } catch (err) {
      console.error('MediaPipe init error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [videoRef, currentExercise, onRepComplete]);

  return { landmarks, isLoading, initMediaPipe };
}