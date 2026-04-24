import React, { useEffect, useState } from 'react';
import { CheckCircle, RefreshCw, TrendingUp, Award, Clock, Send, Download } from 'lucide-react';
import type { SurveyData } from './RedFlagSurvey';

interface ExerciseResult {
  exerciseId: string;
  exerciseName: string;
  repsCompleted: number;
  elapsedSeconds: number;
}

interface SessionSummaryProps {
  data: Record<string, unknown>;
  surveyData?: SurveyData;
  onRestart: () => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function SessionSummary({ data, surveyData, onRestart }: SessionSummaryProps) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const {
    condition = '',
    phase = 1,
    phaseName = '',
    exerciseResults = [],
    totalReps = 0,
    totalTimeSeconds = 0,
    sessionDate = new Date().toISOString(),
  } = data as {
    condition: string;
    phase: number;
    phaseName: string;
    exerciseResults: ExerciseResult[];
    totalReps: number;
    totalTimeSeconds: number;
    sessionDate: string;
  };

  const painBefore = (data.painBefore as number) ?? 5;
  const painAfter  = surveyData?.painAfter ?? painBefore;
  const painDelta  = painAfter - painBefore;
  const difficulty = surveyData?.difficulty ?? 'moderate';
  const notes      = surveyData?.notes ?? '';
  const anyFlags   = surveyData?.anyRedFlags ?? false;

  const complianceScore = Math.round(
    exerciseResults.length > 0
      ? (exerciseResults.reduce((sum, r) => sum + Math.min(r.repsCompleted / Math.max(r.repsCompleted, 1), 1), 0) / exerciseResults.length) * 100
      : 80
  );

  const grade = complianceScore >= 90 ? 'Excellent' : complianceScore >= 75 ? 'Good' : complianceScore >= 60 ? 'Fair' : 'Needs Work';
  const gradeColor = complianceScore >= 90 ? '#1e7d8c' : complianceScore >= 75 ? '#2a9aad' : complianceScore >= 60 ? '#d4a017' : '#c0392b';

  const sendReport = async () => {
    setSending(true);
    try {
      const stored = localStorage.getItem('sb-tvjeejcahsdycvcuflxf-auth-token');
      const userId = stored ? JSON.parse(stored)?.user?.id : null;
      if (!userId) { setSending(false); return; }

      await fetch('http://localhost:8001/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          condition: String(condition),
          phase: Number(phase),
          pain_before: painBefore,
          pain_after: painAfter,
          difficulty,
          notes,
          red_flags: surveyData?.redFlags ?? {},
          exercises: (exerciseResults as ExerciseResult[]).map(r => ({
            name: r.exerciseName,
            reps_done: r.repsCompleted,
            duration_seconds: r.elapsedSeconds,
          })),
          total_reps: Number(totalReps),
          total_time_seconds: Number(totalTimeSeconds),
          compliance_score: complianceScore,
          grade,
          session_date: String(sessionDate),
        }),
      });
      setSent(true);
    } catch (e) {
      console.error('Failed to send report:', e);
    }
    setSending(false);
  };

  // Auto-send on mount
  useEffect(() => { sendReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadPDF = () => {
    const printContent = `
      <html><head><title>SpineGuard Session Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #2c3e3f; max-width: 700px; margin: 0 auto; }
        h1 { color: #1e7d8c; font-size: 22px; margin-bottom: 4px; }
        h2 { color: #1e7d8c; font-size: 14px; border-bottom: 2px solid #ecf8f8; padding-bottom: 6px; margin-top: 24px; text-transform: uppercase; letter-spacing: 1px; }
        .meta { color: #8a9e9f; font-size: 13px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 16px 0; }
        .box { background: #f5efec; border-radius: 8px; padding: 12px; }
        .box-label { font-size: 10px; color: #8a9e9f; text-transform: uppercase; letter-spacing: 1px; }
        .box-value { font-size: 18px; font-weight: 700; color: #1e7d8c; margin-top: 4px; }
        .ex-row { display: flex; justify-content: space-between; padding: 8px 12px; background: #f5efec; border-radius: 6px; margin-bottom: 6px; font-size: 13px; }
        .flag { background: #fde8e8; color: #c0392b; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-top: 8px; }
        .footer { margin-top: 32px; font-size: 10px; color: #8a9e9f; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <h1>🦴 SpineGuard — Session Report</h1>
      <div class="meta">
        ${String(condition)} · Phase ${phase} (${phaseName}) · 
        ${new Date(String(sessionDate)).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
      </div>
      <h2>Performance Summary</h2>
      <div class="grid">
        <div class="box"><div class="box-label">Grade</div><div class="box-value" style="color:${gradeColor}">${grade}</div></div>
        <div class="box"><div class="box-label">Compliance</div><div class="box-value">${complianceScore}%</div></div>
        <div class="box"><div class="box-label">Total Reps</div><div class="box-value">${totalReps}</div></div>
        <div class="box"><div class="box-label">Duration</div><div class="box-value">${formatTime(Number(totalTimeSeconds))}</div></div>
        <div class="box"><div class="box-label">Pain Before</div><div class="box-value">${painBefore}/10</div></div>
        <div class="box"><div class="box-label">Pain After</div><div class="box-value" style="color:${painDelta < 0 ? '#1e7d8c' : '#c0392b'}">${painAfter}/10 (${painDelta > 0 ? '+' : ''}${painDelta})</div></div>
      </div>
      ${(exerciseResults as ExerciseResult[]).length > 0 ? `
        <h2>Exercise Breakdown</h2>
        ${(exerciseResults as ExerciseResult[]).map(r => `
          <div class="ex-row"><span>${r.exerciseName}</span><span>${r.repsCompleted} reps · ${formatTime(r.elapsedSeconds)}</span></div>
        `).join('')}
      ` : ''}
      ${notes ? `<h2>Patient Notes</h2><p style="font-size:13px;font-style:italic">"${notes}"</p>` : ''}
      ${difficulty ? `<p style="font-size:13px">Session difficulty: <strong>${difficulty}</strong></p>` : ''}
      ${anyFlags ? `<div class="flag">⚠ Red flags were reported. Please consult your doctor.</div>` : ''}
      <div class="footer">Generated by SpineGuard AI · For clinical reference only · Not a substitute for professional medical advice</div>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(printContent);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 500);
    }
  };

  return (
    <div className="summary-screen">
      <div className="summary-card" style={{ maxWidth: 600 }}>
        <div className="summary-header">
          <CheckCircle size={52} style={{ color: '#1e7d8c' }} />
          <h2>Session Complete!</h2>
          <p className="summary-date">
            {new Date(String(sessionDate)).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
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
            <Clock size={22} />
            <span className="stat-num">{formatTime(Number(totalTimeSeconds))}</span>
            <span className="stat-label">Duration</span>
          </div>
          <div className="stat-box">
            <Award size={22} />
            <span className="stat-num">{complianceScore}%</span>
            <span className="stat-label">Compliance</span>
          </div>
          <div className="stat-box">
            <span style={{ fontSize: 22 }}>{painDelta < 0 ? '📉' : painDelta > 0 ? '📈' : '➡️'}</span>
            <span className="stat-num" style={{ color: painDelta < 0 ? '#1e7d8c' : painDelta > 0 ? '#c0392b' : '#8a9e9f' }}>
              {painBefore} → {painAfter}
            </span>
            <span className="stat-label">Pain Score</span>
          </div>
        </div>

        {(exerciseResults as ExerciseResult[]).length > 0 && (
          <div className="summary-insights">
            <h3>Exercise Breakdown</h3>
            {(exerciseResults as ExerciseResult[]).map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#f5efec', borderRadius: 8,
                marginBottom: 8, fontSize: 14,
              }}>
                <span style={{ fontWeight: 600, color: '#2c3e3f' }}>{r.exerciseName}</span>
                <span style={{ color: '#5a6e6f' }}>{r.repsCompleted} reps · {formatTime(r.elapsedSeconds)}</span>
              </div>
            ))}
          </div>
        )}

        {(difficulty || notes) && (
          <div className="summary-insights">
            <h3>Session Notes</h3>
            <p className="insight info">Difficulty: <strong>{difficulty}</strong></p>
            {notes && <p className="insight info">"{notes}"</p>}
            {anyFlags && <p className="insight warn">⚠ Red flags reported — doctor has been notified.</p>}
          </div>
        )}

        <div className="summary-insights">
          <p className={`insight ${sent ? 'good' : 'info'}`}>
            {sending ? '⏳ Sending report to your doctor...' :
             sent ? '✓ Report sent to your doctor\'s dashboard.' :
             '📋 Report will be sent to your doctor.'}
          </p>
        </div>

        <div className="summary-footer" style={{ gap: 12, flexDirection: 'column' }}>
          <button className="btn-primary" onClick={handleDownloadPDF}
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: 'linear-gradient(135deg,#1e7d8c,#2a9aad)' }}>
            <Download size={18} /> Download PDF Report
          </button>
          {!sent && !sending && (
            <button className="btn-secondary" onClick={sendReport}
              style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <Send size={16} /> Resend to Doctor
            </button>
          )}
          <button className="btn-secondary" onClick={onRestart}>
            <RefreshCw size={18} /> Start Another Session
          </button>
        </div>
      </div>
    </div>
  );
}
