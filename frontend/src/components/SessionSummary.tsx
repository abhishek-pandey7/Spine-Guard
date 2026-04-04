import React from 'react';
import { CheckCircle, RefreshCw, TrendingUp, Award, Clock } from 'lucide-react';

interface SessionSummaryProps {
  data: Record<string, unknown>;
  onRestart: () => void;
}

export default function SessionSummary({ data, onRestart }: SessionSummaryProps) {
  const {
    totalReps = 0,
    compliantReps = 0,
    complianceScore = 0,
    peakAngle = 0,
    sessionDate = '',
  } = data as Record<string, number | string>;

  const score = Number(complianceScore);

  const grade =
    score >= 90 ? 'Excellent' :
    score >= 75 ? 'Good' :
    score >= 60 ? 'Fair' : 'Needs Improvement';

  const gradeColor =
    score >= 90 ? '#22c55e' :
    score >= 75 ? '#3b82f6' :
    score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="summary-screen">
      <div className="summary-card">
        <div className="summary-header">
          <CheckCircle size={52} style={{ color: '#22c55e' }} />
          <h2>Session Complete!</h2>
          <p className="summary-date">
            {sessionDate
              ? new Date(String(sessionDate)).toLocaleDateString('en-US', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })
              : new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="grade-display" style={{ borderColor: gradeColor }}>
          <span className="grade-label">Overall Grade</span>
          <span className="grade-value" style={{ color: gradeColor }}>{grade}</span>
        </div>

        <div className="stats-grid">
          <div className="stat-box">
            <TrendingUp size={22} />
            <span className="stat-num">{String(totalReps)}</span>
            <span className="stat-label">Total Reps</span>
          </div>
          <div className="stat-box">
            <Award size={22} />
            <span className="stat-num">{String(compliantReps)}</span>
            <span className="stat-label">Clean Reps</span>
          </div>
          <div className="stat-box">
            <CheckCircle size={22} />
            <span className="stat-num">{score}%</span>
            <span className="stat-label">Compliance</span>
          </div>
          <div className="stat-box">
            <Clock size={22} />
            <span className="stat-num">{Number(peakAngle).toFixed(1)}°</span>
            <span className="stat-label">Peak Angle</span>
          </div>
        </div>

        <div className="summary-insights">
          <h3>Clinical Insights</h3>
          {score >= 80 ? (
            <p className="insight good">
              ✅ Excellent form maintained. Your spine stayed neutral throughout most reps.
            </p>
          ) : (
            <p className="insight warn">
              ⚠️ Some form corrections were needed. Focus on keeping your back flat during the next session.
            </p>
          )}
          <p className="insight info">
            📊 This session data has been sent to your care team's dashboard.
          </p>
        </div>

        <div className="summary-footer">
          <button className="btn-primary" onClick={onRestart}>
            <RefreshCw size={18} />
            Start Another Session
          </button>
        </div>
      </div>
    </div>
  );
}