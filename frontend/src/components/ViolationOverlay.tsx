import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ViolationOverlayProps {
  violations: string[];
}

const VIOLATION_MESSAGES: Record<string, string> = {
  Bending: 'STOP — Back Bending Detected',
  Twisting: 'STOP — Twisting Detected',
  Lifting: 'STOP — Unsafe Lift Detected',
};

export default function ViolationOverlay({ violations }: ViolationOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth; // force reflow
    el.classList.add('flash');
  }, [violations.join(',')]);

  if (violations.length === 0) return null;

  const primary = violations[0];
  const message = VIOLATION_MESSAGES[primary] ?? `STOP — ${primary} Detected`;

  return (
    <div ref={overlayRef} className="violation-overlay">
      <div className="violation-content">
        <AlertTriangle size={48} className="violation-icon" />
        <div className="violation-message">{message}</div>
        <div className="violation-sub">Reset your posture before continuing</div>
        {violations.length > 1 && (
          <div className="violation-list">
            {violations.map((v, i) => (
              <span key={i} className="violation-tag">{v}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}