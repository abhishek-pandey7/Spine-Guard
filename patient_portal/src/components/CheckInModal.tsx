import React, { useState } from 'react';
import { Activity } from 'lucide-react';

interface CheckInModalProps {
  onConfirm: (painScore: number) => void;
}

const PAIN_LABELS: Record<number, string> = {
  0: 'No pain', 1: 'Very mild', 2: 'Mild', 3: 'Moderate',
  4: 'Somewhat severe', 5: 'Severe', 6: 'Very severe',
  7: 'Intense', 8: 'Very intense', 9: 'Excruciating', 10: 'Worst pain',
};

const PAIN_COLORS: Record<number, string> = {
  0: '#22c55e', 1: '#4ade80', 2: '#86efac', 3: '#fbbf24',
  4: '#f97316', 5: '#ef4444', 6: '#dc2626', 7: '#b91c1c',
  8: '#991b1b', 9: '#7f1d1d', 10: '#450a0a',
};

export default function CheckInModal({ onConfirm }: CheckInModalProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="checkin-screen">
      <div className="checkin-card">
        <div className="checkin-header">
          <Activity size={40} className="checkin-icon" />
          <h1>Daily Check-In</h1>
          <p>Before we begin, how is your pain level today?</p>
        </div>
        <div className="pain-scale">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`pain-btn ${selected === i ? 'selected' : ''}`}
              style={{
                background: selected === i ? PAIN_COLORS[i] : undefined,
                borderColor: selected === i ? PAIN_COLORS[i] : undefined,
              }}
            >
              {i}
            </button>
          ))}
        </div>
        {selected !== null && (
          <div className="pain-feedback" style={{ color: PAIN_COLORS[selected] }}>
            <span className="pain-level-text">{selected}/10 — {PAIN_LABELS[selected]}</span>
            {selected > 4 && (
              <p className="pain-warning">
                [!] Pain above 4. We'll start with gentle Phase 1 exercises only.
              </p>
            )}
          </div>
        )}
        <div className="checkin-footer">
          <button
            className="btn-confirm"
            disabled={selected === null}
            onClick={() => selected !== null && onConfirm(selected)}
          >
            Begin Session
          </button>
          <p className="checkin-disclaimer">
            If pain is 8 or above, please contact your surgeon before exercising.
          </p>
        </div>
      </div>
    </div>
  );
}