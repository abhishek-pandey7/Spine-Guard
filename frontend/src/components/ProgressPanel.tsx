import React from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Target, Award } from 'lucide-react';

export default function ProgressPanel() {
  const { currentRep, totalReps, compliance } = useSessionStore();
  const repPercent = totalReps > 0 ? (currentRep / totalReps) * 100 : 0;

  return (
    <div className="progress-panel">
      <div className="progress-metric">
        <Target size={16} className="metric-icon" />
        <div className="metric-info">
          <span className="metric-label">Reps</span>
          <span className="metric-value">{currentRep}/{totalReps}</span>
        </div>
        <div className="rep-bar"><div className="rep-fill" style={{ width: `${repPercent}%` }} /></div>
      </div>
      <div className="progress-metric">
        <Award size={16} className="metric-icon" />
        <div className="metric-info">
          <span className="metric-label">Compliance</span>
          <span className={`metric-value ${compliance >= 80 ? 'text-green' : compliance >= 60 ? 'text-yellow' : 'text-red'}`}>
            {compliance}%
          </span>
        </div>
      </div>
    </div>
  );
}