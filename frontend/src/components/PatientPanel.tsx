import React, { useRef, useEffect, useState, useCallback } from 'react';
import { type Exercise } from '../types/exercise';
import SkeletonCanvas from './SkeletonCanvas';
import ViolationOverlay from './ViolationOverlay';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useVoiceEngine } from '../hooks/useVoiceEngine';
import { useSessionTracker } from '../hooks/useSessionTracker';
import { useLightingCheck } from '../hooks/useLightingCheck';
import { analyzeSpine } from '../utils/spineAnalyzer';
import { getExerciseGuard } from '../utils/exerciseGuards';
import { Camera, CameraOff, StopCircle, Sun } from 'lucide-react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

interface PatientPanelProps {
  exercise: Exercise;
  onSessionEnd: (data: Record<string, unknown>) => void;
}

export default function PatientPanel({ exercise, onSessionEnd }: PatientPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [isViolating, setIsViolating] = useState(false);

  const { landmarks, initMediaPipe, isLoading } = useMediaPipe(videoRef);
  const { speak } = useVoiceEngine();
  const { currentRep, peakAngle, endSession } = useSessionTracker();
  const { lightingStatus, getLightingMessage, checkLighting } = useLightingCheck();

  const startCamera = useCallback(async () => {
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

  useEffect(() => {
    if (!landmarks || landmarks.length === 0) return;
    // Cast to Landmark type for our utils
    const lm = landmarks as unknown as import('../types/session').Landmark[];
    const spineResult = analyzeSpine(lm);
    const guardResult = getExerciseGuard(exercise.id, lm);

    const active: string[] = [];
    if (spineResult.isBending) active.push('Bending');
    if (spineResult.isTwisting) active.push('Twisting');
    if (guardResult?.violation) active.push(guardResult.message);

    setViolations(active);
    setIsViolating(active.length > 0);

    if (active.length > 0) {
      const msg = spineResult.isBending
        ? 'Stop. Your back is bending. Please reset your posture.'
        : spineResult.isTwisting
        ? 'Twist detected! Move your whole body together.'
        : guardResult?.message ?? 'Check your form.';
      speak(msg, 3000);
    }
  }, [landmarks, exercise.id, speak]);

  const handleEndSession = async () => {
    stopCamera();
    const data = await endSession(exercise.id, 1);
    onSessionEnd(data as Record<string, unknown>);
  };

  const lightingMsg = getLightingMessage();

  return (
    <div className="patient-panel">
      <div className="patient-header">
        <div className="patient-label"><span className="patient-icon">👤</span><span>Your Movement</span></div>
        <div className={`status-dot ${cameraActive ? (isViolating ? 'red' : 'green') : 'gray'}`} />
      </div>
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted className="patient-video"
          style={{ display: cameraActive ? 'block' : 'none' }} />
        {cameraActive && (
          <SkeletonCanvas landmarks={landmarks as NormalizedLandmark[] | null} videoRef={videoRef} isViolating={isViolating} />
        )}
        {isViolating && <ViolationOverlay violations={violations} />}
        {!cameraActive && (
          <div className="camera-placeholder">
            {isLoading ? (
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
      <div className="live-metrics">
        <div className="metric-card"><span className="metric-label">Reps Done</span><span className="metric-value green">{currentRep}</span></div>
        <div className="metric-card"><span className="metric-label">Peak Angle</span><span className="metric-value blue">{peakAngle.toFixed(1)}°</span></div>
        <div className={`metric-card ${isViolating ? 'violation' : ''}`}>
          <span className="metric-label">Form</span>
          <span className={`metric-value ${isViolating ? 'red' : 'green'}`}>{isViolating ? '⚠ Fix Form' : '✓ Good'}</span>
        </div>
      </div>
      <div className="patient-controls">
        {!cameraActive ? (
          <button onClick={startCamera} className="btn-primary" disabled={isLoading}><Camera size={18} />Start Camera</button>
        ) : (
          <button onClick={handleEndSession} className="btn-danger"><StopCircle size={18} />End Session</button>
        )}
      </div>
    </div>
  );
}