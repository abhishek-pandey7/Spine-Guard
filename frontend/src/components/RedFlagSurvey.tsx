import React, { useState } from 'react';
import { AlertTriangle, Phone } from 'lucide-react';

interface RedFlagSurveyProps {
  onComplete: () => void;
}

const QUESTIONS = [
  { id: 'numbness', text: 'Are you experiencing new numbness or tingling in your legs or feet?' },
  { id: 'weakness', text: 'Do you notice new weakness in your legs compared to before this session?' },
  { id: 'bladder', text: 'Any new difficulty with bladder or bowel control?' },
  { id: 'pain_increase', text: 'Has your back or leg pain significantly increased during this session?' },
];

export default function RedFlagSurvey({ onComplete }: RedFlagSurveyProps) {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [showAlert, setShowAlert] = useState(false);

  const setAnswer = (id: string, value: boolean) => {
    const updated = { ...answers, [id]: value };
    setAnswers(updated);
    if (value) setShowAlert(true);
  };

  const allAnswered = QUESTIONS.every((q) => answers[q.id] !== undefined);
  const anyYes = Object.values(answers).some((v) => v === true);

  return (
    <div className="survey-screen">
      <div className="survey-card">
        <div className="survey-header">
          <h2>Post-Session Check</h2>
          <p>Please answer these important safety questions before finishing.</p>
        </div>
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
              <p className="alert-body">These symptoms may indicate a surgical complication. Please contact your surgeon immediately.</p>
              <a href="tel:+911" className="surgeon-call-btn"><Phone size={18} />Call Surgeon Now</a>
            </div>
          </div>
        )}
        <div className="survey-footer">
          <button className="btn-confirm" disabled={!allAnswered} onClick={onComplete}>
            {anyYes ? 'Continue to Summary (Surgeon Notified)' : 'Complete Session'}
          </button>
        </div>
      </div>
    </div>
  );
}