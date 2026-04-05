import React, { useState } from 'react';
import { AlertTriangle, Phone } from 'lucide-react';

interface RedFlagSurveyProps {
  onComplete: (surveyData: SurveyData) => void;
  painBefore?: number;
}

export interface SurveyData {
  redFlags: Record<string, boolean>;
  painAfter: number;
  difficulty: 'easy' | 'moderate' | 'hard';
  notes: string;
  anyRedFlags: boolean;
}

const QUESTIONS = [
  { id: 'numbness',      text: 'New numbness or tingling in legs or feet?' },
  { id: 'weakness',      text: 'New weakness in legs compared to before?' },
  { id: 'bladder',       text: 'Any difficulty with bladder or bowel control?' },
  { id: 'pain_increase', text: 'Has pain significantly increased during this session?' },
];

export default function RedFlagSurvey({ onComplete, painBefore = 5 }: RedFlagSurveyProps) {
  const [answers, setAnswers]     = useState<Record<string, boolean | null>>({});
  const [painAfter, setPainAfter] = useState(painBefore);
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'hard'>('moderate');
  const [notes, setNotes]         = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const setAnswer = (id: string, value: boolean) => {
    const updated = { ...answers, [id]: value };
    setAnswers(updated);
    if (value) setShowAlert(true);
  };

  const allAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined);
  const anyYes = Object.values(answers).some((v) => v === true);

  const handleComplete = () => {
    onComplete({
      redFlags: Object.fromEntries(
        Object.entries(answers).map(([k, v]) => [k, Boolean(v)])
      ),
      painAfter,
      difficulty,
      notes,
      anyRedFlags: anyYes,
    });
  };

  const painDelta = painAfter - painBefore;
  const painColor = painDelta < 0 ? '#1e7d8c' : painDelta > 0 ? '#c0392b' : '#8a9e9f';

  return (
    <div className="survey-screen">
      <div className="survey-card">
        <div className="survey-header">
          <h2>Post-Session Check</h2>
          <p>A few quick questions before we generate your report.</p>
        </div>

        {/* Safety questions */}
        <div className="survey-questions">
          {QUESTIONS.map((q) => (
            <div key={q.id} className={`survey-question ${answers[q.id] === true ? 'flagged' : ''}`}>
              <p className="question-text">{q.text}</p>
              <div className="answer-btns">
                <button className={`answer-btn no ${answers[q.id] === false ? 'active' : ''}`} onClick={() => setAnswer(q.id, false)}>No</button>
                <button className={`answer-btn yes ${answers[q.id] === true ? 'active' : ''}`} onClick={() => setAnswer(q.id, true)}>Yes</button>
              </div>
            </div>
          ))}
        </div>

        {showAlert && anyYes && (
          <div className="red-flag-alert">
            <AlertTriangle size={24} />
            <div>
              <p className="alert-title">New symptoms detected</p>
              <p className="alert-body">These symptoms may indicate a complication. Please contact your surgeon.</p>
              <a href="tel:+911" className="surgeon-call-btn"><Phone size={18} />Call Surgeon Now</a>
            </div>
          </div>
        )}

        {/* Pain level after */}
        <div className="survey-question" style={{ marginTop: 16 }}>
          <p className="question-text" style={{ fontWeight: 600 }}>
            Pain level now: <span style={{ color: painColor, fontWeight: 700 }}>{painAfter}/10</span>
            {painDelta !== 0 && (
              <span style={{ fontSize: 13, marginLeft: 8, color: painColor }}>
                ({painDelta > 0 ? '+' : ''}{painDelta} from before)
              </span>
            )}
          </p>
          <input type="range" min={0} max={10} value={painAfter}
            onChange={e => setPainAfter(+e.target.value)}
            style={{ width: '100%', marginTop: 8, accentColor: '#1e7d8c' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8a9e9f', marginTop: 4 }}>
            <span>No pain</span><span>Worst pain</span>
          </div>
        </div>

        {/* Difficulty */}
        <div className="survey-question">
          <p className="question-text" style={{ fontWeight: 600 }}>How difficult was this session?</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {(['easy', 'moderate', 'hard'] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid',
                  borderColor: difficulty === d ? '#1e7d8c' : '#d4c4bc',
                  background: difficulty === d ? 'rgba(30,125,140,0.1)' : 'transparent',
                  color: difficulty === d ? '#1e7d8c' : '#5a6e6f',
                  cursor: 'pointer', fontSize: 14, fontWeight: difficulty === d ? 700 : 400,
                  textTransform: 'capitalize', fontFamily: 'inherit',
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="survey-question">
          <p className="question-text" style={{ fontWeight: 600 }}>Any notes for your doctor? <span style={{ fontWeight: 400, color: '#8a9e9f' }}>(optional)</span></p>
          <textarea
            rows={3}
            placeholder="e.g. Felt tightness in lower back during squats, right knee uncomfortable..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{
              width: '100%', marginTop: 8, padding: '10px 12px',
              border: '1.5px solid #d4c4bc', borderRadius: 8,
              background: '#f9f4f1', color: '#2c3e3f', fontSize: 14,
              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            }}
          />
        </div>

        <div className="survey-footer">
          <button className="btn-confirm" disabled={!allAnswered} onClick={handleComplete}>
            {anyYes ? 'Continue (Doctor Notified)' : 'Generate Session Report →'}
          </button>
        </div>
      </div>
    </div>
  );
}
