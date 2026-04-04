import React, { useRef, useEffect } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

interface SkeletonCanvasProps {
  landmarks: NormalizedLandmark[] | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  isViolating: boolean;
}

const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32],
];

const SPINE_POINTS = new Set([0, 11, 12, 23, 24]);

export default function SkeletonCanvas({ landmarks, videoRef, isViolating }: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || landmarks.length === 0) return;

    const primary = isViolating ? '#ef4444' : '#22c55e';
    const secondary = isViolating ? '#fca5a5' : '#86efac';
    const glow = isViolating ? 'rgba(239,68,68,0.45)' : 'rgba(34,197,94,0.45)';

    // Connections
    ctx.lineWidth = 3;
    ctx.strokeStyle = primary;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;

    for (const [a, b] of POSE_CONNECTIONS) {
      const lA = landmarks[a];
      const lB = landmarks[b];
      if (!lA || !lB) continue;
      ctx.beginPath();
      ctx.moveTo(lA.x * canvas.width, lA.y * canvas.height);
      ctx.lineTo(lB.x * canvas.width, lB.y * canvas.height);
      ctx.stroke();
    }

    // Landmark dots
    ctx.shadowBlur = 14;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!lm) continue;
      const isSpine = SPINE_POINTS.has(i);
      const r = isSpine ? 7 : 4;
      ctx.beginPath();
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSpine ? primary : secondary;
      ctx.fill();
      if (isSpine) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Spine centre line (dashed)
    const lS = landmarks[11];
    const rS = landmarks[12];
    const lH = landmarks[23];
    const rH = landmarks[24];

    if (lS && rS && lH && rH) {
      const mSX = ((lS.x + rS.x) / 2) * canvas.width;
      const mSY = ((lS.y + rS.y) / 2) * canvas.height;
      const mHX = ((lH.x + rH.x) / 2) * canvas.width;
      const mHY = ((lH.y + rH.y) / 2) * canvas.height;

      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isViolating ? '#fbbf24' : '#a3e635';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(mSX, mSY);
      ctx.lineTo(mHX, mHY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowBlur = 0;
  }, [landmarks, isViolating, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="skeleton-canvas"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}