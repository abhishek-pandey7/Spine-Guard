import { useRef, useEffect, useState, useCallback } from 'react';
import { type Exercise } from '../types/exercise';
import SkeletonCanvas from './SkeletonCanvas';
import ViolationOverlay from './ViolationOverlay';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useVoiceEngine } from '../hooks/useVoiceEngine';
import { useSessionTracker } from '../hooks/useSessionTracker';
import { useLightingCheck } from '../hooks/useLightingCheck';
import { useExerciseWebSocket } from '../hooks/useExerciseWebSocket';
import { analyzeSpine } from '../utils/spineAnalyzer';
import { Camera, CameraOff, StopCircle, Sun, Clock } from 'lucide-react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useSessionStore } from '../stores/sessionStore';

// MediaPipe landmark indices - removed unused LM constants

function exerciseIdToKey(id: string): string {
  return id.replace(/-/g, '_');
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface PatientPanelProps {
  exercise: Exercise;
  onExerciseComplete: (repCount: number, elapsedSeconds: number) => void;
  onSessionEnd: (data: Record<string, unknown>) => void;
}

export default function PatientPanel({ exercise, onExerciseComplete, onSessionEnd }: PatientPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [isViolating, setIsViolating] = useState(false);
  const [wsRepCount, setWsRepCount] = useState(0);
  const [wsCue, setWsCue] = useState('');
  const [mpLoading, setMpLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [exerciseComplete, setExerciseComplete] = useState(false);

  const frameIdRef = useRef(0);
  const prevWsRepRef = useRef(0);
  const angleHistoryRef = useRef<number[]>([]);
  const localRepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeEmittedRef = useRef(false);
  // Ref-based violation flag so the timer interval doesn't need to be recreated on every form change
  const isViolatingRef = useRef(false);
  // Throttle: only send landmarks to backend at most every 100ms (10fps)
  const lastSendRef = useRef<number>(0);

  const { landmarks, initMediaPipe } = useMediaPipe(videoRef);
  const { speak, speakPriority, speakChecks } = useVoiceEngine();
  const { currentRep, peakAngle, endSession } = useSessionTracker();
  const { lightingStatus, getLightingMessage, checkLighting } = useLightingCheck();
  const { updatePeakAngle } = useSessionStore();

  const exerciseKey = exerciseIdToKey(exercise.id);

  const {
    isConnected,
    lastResult,
    connect,
    sendLandmarks,
  } = useExerciseWebSocket();

  // Connect to Python backend + announce exercise name on load
  useEffect(() => {
    connect(exerciseKey);
    setWsRepCount(0);
    prevWsRepRef.current = 0;
    localRepRef.current = 0;
    angleHistoryRef.current = [];
    completeEmittedRef.current = false;
    setExerciseComplete(false);
    // Announce the new exercise by name
    speak(`Starting ${exercise.name}. ${exercise.coachCue ?? ''}`, 0);
    return () => { /* cleanup handled by hook unmount */ };
  }, [exerciseKey, connect, exercise.name, exercise.coachCue, speak]);

  // Keep violation ref in sync with state (without triggering timer effect)
  useEffect(() => {
    isViolatingRef.current = isViolating;
  }, [isViolating]);

  // Session timer (Pausable: only increments on good form)
  // Uses isViolatingRef so this effect only runs when cameraActive changes,
  // not on every form update — prevents constant interval recreation.
  useEffect(() => {
    if (!cameraActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        // Read from ref — no stale closure, no effect re-run needed
        if (!isViolatingRef.current) return prev + 1;
        return prev;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cameraActive]);

  // Stream landmarks to backend — throttled to 10fps to prevent WebSocket flooding
  useEffect(() => {
    if (!landmarks || landmarks.length === 0) return;
    if (!isConnected) return;

    const now = Date.now();
    if (now - lastSendRef.current < 100) return; // max 10fps
    lastSendRef.current = now;

    frameIdRef.current += 1;
    const lmArray = landmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z ?? 0,
      visibility: lm.visibility ?? 1,
    }));
    sendLandmarks(lmArray, frameIdRef.current);
  }, [landmarks, isConnected, sendLandmarks]);

  // Process WebSocket evaluation results
  useEffect(() => {
    if (!lastResult) return;

    // PRIMARY: Trust Python's rep count (state machine: STAND→SQUAT→STAND, etc.)
    const pythonRepCount = lastResult.rep_count ?? 0;
    setWsRepCount(pythonRepCount);
    setWsCue(lastResult.primary_cue);

    // Update peak angle from backend
    if (lastResult.primary_angle && lastResult.primary_angle > 0) {
      updatePeakAngle(lastResult.primary_angle);
    }

    // Check if exercise is complete (reached target duration)
    const targetDuration = exercise.durationSeconds || 60;
    if (elapsedSeconds >= targetDuration && !completeEmittedRef.current) {

      completeEmittedRef.current = true;
      setExerciseComplete(true);
      speakPriority(`Time's up! Exercise complete. Great work!`);
      // We still pass pythonRepCount for logging
      onExerciseComplete(pythonRepCount, elapsedSeconds);
    }

    // Time milestones (announce every 15s or 10s depending on duration)
    const remaining = targetDuration - elapsedSeconds;
    if (remaining > 0 && remaining % 15 === 0 && elapsedSeconds > 0) {
      speak(`${remaining} seconds remaining. Keep it up!`, 5000);
    }

    // Detect a new rep and announce it (secondary to time now)
    if (pythonRepCount > prevWsRepRef.current) {
      speakPriority(`Rep ${pythonRepCount}.`);
      prevWsRepRef.current = pythonRepCount;
    }

    // Build violations from Python checks
    const active: string[] = [];
    if (lastResult.checks) {
      for (const [_checkName, [passed, _value, cue]] of Object.entries(lastResult.checks)) {
        if (!passed) {
          active.push(cue);
        }
      }
    }

    // Also run local spine analyzer as fallback
    const lm = landmarks as unknown as import('../types/session').Landmark[];
    const spineResult = analyzeSpine(lm);
    if (spineResult.isBending) active.push('Bending');
    if (spineResult.isTwisting) active.push('Twisting');

    const hasViolation = !lastResult.passed || active.length > 0;
    setViolations(active);
    setIsViolating(hasViolation);

    // Voice coaching: rotate through ALL failing check cues for specific corrections
    if (!lastResult.passed && lastResult.checks) {
      const checksWithMultiple = Object.keys(lastResult.checks).length > 1;
      if (checksWithMultiple) {
        // Multi-check exercises: cycle through each failing check's specific cue
        speakChecks(lastResult.checks);
      } else if (lastResult.primary_cue) {
        // Single-check (similarity-only): use primary_cue with throttle
        speak(lastResult.primary_cue, 5000);
      }
    } else if (lastResult.passed && lastResult.primary_cue) {
      // Positive reinforcement during good form (longer cooldown — don't interrupt focus)
      speak(lastResult.primary_cue, 8000);
    }
  }, [lastResult, landmarks, speak, speakPriority, speakChecks, isConnected, exercise.durationSeconds, elapsedSeconds, onExerciseComplete]);


  const startCamera = useCallback(async () => {
    setMpLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);
        await initMediaPipe();
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions.');
    } finally {
      setMpLoading(false);
    }
  }, [initMediaPipe]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    const interval = setInterval(() => checkLighting(videoRef.current), 5000);
    checkLighting(videoRef.current);
    return () => clearInterval(interval);
  }, [cameraActive, checkLighting]);

  const handleEndSession = async () => {
    stopCamera();
    const data = await endSession(exercise.id, 1);
    onSessionEnd(data as Record<string, unknown>);
  };

  const lightingMsg = getLightingMessage();

  const displayRepCount = wsRepCount > 0 ? wsRepCount : currentRep;
  const targetDuration = exercise.durationSeconds || 60;
  const timeProgress = Math.min((elapsedSeconds / targetDuration) * 100, 100);

  // Extract primary angle from backend
  const displayAngle = (() => {
    if (lastResult?.primary_angle && lastResult.primary_angle > 0) {
      return lastResult.primary_angle.toFixed(1);
    }
    if (lastResult?.checks) {
      for (const [key, val] of Object.entries(lastResult.checks)) {
        if (key !== 'similarity' && Array.isArray(val) && typeof val[1] === 'number' && val[1] > 0) {
          return val[1].toFixed(1);
        }
      }
    }
    return peakAngle.toFixed(1);
  })();

  return (
    <div className="patient-panel">
      <div className="patient-header">
        <div className="patient-label"><span className="patient-icon">User</span><span>Your Movement</span></div>
        <div className={`status-dot ${cameraActive ? (isViolating ? 'red' : 'green') : 'gray'}`} />
        <span className="ws-status" style={{ fontSize: 11, marginLeft: 8, color: isConnected ? '#4ade80' : '#f87171' }}>
          {isConnected ? '● Python AI' : '○ Local Only'}
        </span>
        <div className="session-timer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: isViolating ? '#f87171' : '#94a3b8', marginLeft: 12 }}>
          <Clock size={14} className={isViolating ? 'animate-pulse' : ''} />
          <span style={{ fontWeight: isViolating ? 'bold' : 'normal' }}>
            {formatTime(targetDuration - elapsedSeconds)} {isViolating ? '(PAUSED)' : 'left'}
          </span>
        </div>
      </div>

      {/* Time progress bar */}
      <div className="rep-progress-bar" style={{
        height: 4,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 2,
        overflow: 'hidden',
        margin: '8px 0 0 0',
      }}>
        <div style={{
          height: '100%',
          width: `${timeProgress}%`,
          background: exerciseComplete ? '#22c55e' : (isViolating ? '#f87171' : 'linear-gradient(90deg, #8b5cf6, #3b82f6)'),
          borderRadius: 2,
          transition: isViolating ? 'none' : 'width 1s linear',
        }} />
      </div>

      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted className="patient-video"
          style={{ display: cameraActive ? 'block' : 'none' }} />
        {cameraActive && (
          <SkeletonCanvas
            landmarks={landmarks as NormalizedLandmark[] | null}
            videoRef={videoRef}
            isViolating={isViolating}
            wsJointPoints={lastResult?.joint_points ?? null}
          />
        )}
        {isViolating && <ViolationOverlay violations={violations} />}
        {!cameraActive && (
          <div className="camera-placeholder">
            {mpLoading ? (
              <div className="loading-spinner"><div className="spinner" /><p>Loading AI engine...</p></div>
            ) : cameraError ? (
              <div className="camera-error"><CameraOff size={48} /><p>{cameraError}</p></div>
            ) : (
              <div className="camera-start">
                <Camera size={64} className="camera-icon-large" />
                <p>Camera feed will appear here</p>
                <p className="camera-sub">AI skeleton overlay enabled</p>
              </div>
            )}
          </div>
        )}
      </div>

      {lightingMsg && lightingStatus !== 'good' && (
        <div className="lighting-warning"><Sun size={16} /><span>{lightingMsg}</span></div>
      )}

      {wsCue && !isViolating && (
        <div className="ws-cue-banner" style={{
          padding: '8px 16px',
          background: 'rgba(0,0,0,0.6)',
          color: '#a7f3d0',
          textAlign: 'center',
          fontSize: 14,
        }}>
          {wsCue}
        </div>
      )}

      {exerciseComplete && (
        <div className="exercise-complete-banner" style={{
          padding: '12px 16px',
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 8,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 600,
          color: '#22c55e',
        }}>
          Exercise Complete! {displayRepCount} reps in {formatTime(elapsedSeconds)}
        </div>
      )}

      <div className="live-metrics">
        <div className="metric-card">
          <span className="metric-label">Time Remaining</span>
          <span className="metric-value" style={{ color: isViolating ? '#f87171' : '#4ade80' }}>
            {formatTime(Math.max(0, targetDuration - elapsedSeconds))}
            {isViolating && <span style={{ fontSize: 10, display: 'block', opacity: 0.8 }}>PAUSED</span>}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Reps (AI)</span>
          <span className="metric-value blue">{displayRepCount}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Peak Angle</span>
          <span className="metric-value blue">{displayAngle}°</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Time</span>
          <span className="metric-value" style={{ color: '#e2e8f0' }}>{formatTime(elapsedSeconds)}</span>

        </div>
        <div className={`metric-card ${isViolating ? 'violation' : ''}`}>
          <span className="metric-label">Form</span>
          <span className={`metric-value ${isViolating ? 'red' : 'green'}`}>{isViolating ? '[!] Fix Form' : '[OK] Good'}</span>
        </div>
      </div>

      <div className="patient-controls">
        {!cameraActive ? (
          <button onClick={startCamera} className="btn-primary" disabled={mpLoading}><Camera size={18} />Start Camera</button>
        ) : (
          <button onClick={handleEndSession} className="btn-danger"><StopCircle size={18} />End Session</button>
        )}
      </div>
    </div>
  );
}
