import React, { useRef, useEffect, useState } from 'react';
import { type Exercise } from '../types/exercise';
import { useCalibration } from '../hooks/useCalibration';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { CheckCircle } from 'lucide-react';

interface CalibrationScreenProps {
  exercise: Exercise;
  onComplete: () => void;
}

export default function CalibrationScreen({ exercise, onComplete }: CalibrationScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const { landmarks, initMediaPipe } = useMediaPipe(videoRef);
  const { isCalibrating, calibrationProgress, isCalibrated, startCalibration, resetCalibration } =
    useCalibration();

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
          await initMediaPipe();
        }
      } catch {
        console.error('Camera error during calibration');
      }
    })();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [initMediaPipe]);

  useEffect(() => {
    if (isCalibrated) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [isCalibrated, onComplete]);

  return (
    <div className="calibration-screen">
      <div className="cal-content">
        <div className="cal-header">
          <h2>Posture Calibration</h2>
          <p>Stand still in your natural upright position for 3 seconds.</p>
          <p className="cal-sub">This sets your personal baseline for spine neutrality.</p>
        </div>
        <div className="cal-video-wrap">
          <video ref={videoRef} autoPlay playsInline muted className="cal-video" />
          <div className="cal-guide">
            <div className="guide-box">
              <div className="guide-corner tl" /><div className="guide-corner tr" />
              <div className="guide-corner bl" /><div className="guide-corner br" />
            </div>
          </div>
        </div>
        {isCalibrating && (
          <div className="cal-progress-wrap">
            <div className="cal-progress-bar">
              <div className="cal-progress-fill" style={{ width: `${calibrationProgress}%` }} />
            </div>
            <p className="cal-progress-label">Hold still... {Math.round(calibrationProgress)}%</p>
          </div>
        )}
        {isCalibrated && (
          <div className="cal-success">
            <CheckCircle size={32} className="success-icon" />
            <p>Baseline set! Starting exercise...</p>
          </div>
        )}
        <div className="cal-actions">
          {!isCalibrating && !isCalibrated && (
            <button className="btn-primary" onClick={() => startCalibration(() => landmarks)} disabled={!cameraReady}>
              Start Calibration
            </button>
          )}
          {isCalibrated && (
            <button className="btn-secondary" onClick={resetCalibration}>Recalibrate</button>
          )}
        </div>
        <div className="cal-tips">
          <p>[-] Stand with feet shoulder-width apart</p>
          <p>[-] Look straight ahead</p>
          <p>[-] Relax your shoulders naturally</p>
        </div>
      </div>
    </div>
  );
}